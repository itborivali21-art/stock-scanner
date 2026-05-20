try { require('dotenv').config(); } catch (e) { /* dotenv not needed on CI */ }
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const fs = require('fs');
const https = require('https');
const path = require('path');

const { calculateIndicators } = require('./indicator-utils');
const { scanPRD, scanRangeShiftDivergence, scanOneRedGreen } = require('./strategies');

// Load settings from .env
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;



// Native HTTPS helper to send messages to Telegram
function sendTelegramMessage(text) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log("Telegram configuration missing. Skipping telegram alert.");
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${BOT_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { resolve(data); });
        });

        req.on('error', (e) => {
            console.error("Telegram send error:", e.message);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

// Main execution function
async function runScanner() {
    console.log("==========================================");
    console.log(`Starting Indian Stock Scanner: ${new Date().toLocaleString()}`);
    console.log("==========================================");

    // Load tickers
    const tickersPath = path.join(__dirname, 'tickers.json');
    if (!fs.existsSync(tickersPath)) {
        console.error("tickers.json not found!");
        return;
    }
    const tickers = JSON.parse(fs.readFileSync(tickersPath, 'utf8'));

    // Date range: 250 calendar days ago to today (to get ~150 trading days)
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 250);

    const allAlerts = [];

    for (const ticker of tickers) {
        process.stdout.write(`Scanning ${ticker}... `);
        try {
            const rawData = await yahooFinance.historical(ticker, {
                period1: pastDate,
                interval: '1d'
            });

            if (!rawData || rawData.length < 30) {
                console.log("Skipped (insufficient data).");
                continue;
            }

            // Clean & sort data
            const candles = rawData
                .filter(c => c.close && c.high && c.low && c.open)
                .map(c => ({
                    date: new Date(c.date).toISOString().split('T')[0],
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume
                }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calculate technical indicators
            const analyzedCandles = calculateIndicators(candles);

            // Scan strategies
            const prdAlerts = scanPRD(analyzedCandles);
            const rangeShiftAlerts = scanRangeShiftDivergence(analyzedCandles);
            const continuationAlerts = scanOneRedGreen(analyzedCandles);

            const tickerAlerts = [...prdAlerts, ...rangeShiftAlerts, ...continuationAlerts];

            if (tickerAlerts.length > 0) {
                console.log(`\x1b[32mFOUND ${tickerAlerts.length} SETUPS\x1b[0m`);
                tickerAlerts.forEach(a => {
                    a.ticker = ticker;
                    allAlerts.push(a);
                });
            } else {
                console.log("No setup.");
            }
        } catch (err) {
            console.log(`\x1b[31mError: ${err.message}\x1b[0m`);
        }
        // Small delay to avoid aggressive rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    console.log("\n==========================================");
    console.log(`Scan Completed. Total alerts found: ${allAlerts.length}`);
    console.log("==========================================");

    // Format & Send Message
    let telegramMessage = `🔔 <b>STRATEGY SCANNER ALERTS (Daily)</b> 🔔\n`;
    telegramMessage += `Date: <code>${today.toISOString().split('T')[0]}</code>\n\n`;

    if (allAlerts.length === 0) {
        telegramMessage += `No active setups found on today's scan.`;
    } else {
        allAlerts.forEach(alert => {
            const cleanTicker = alert.ticker.replace('^', '\\^'); // Escape symbol for markdown if needed
            telegramMessage += `📈 <b>${alert.ticker}</b> - <i>${alert.name || alert.strategy}</i>\n`;
            telegramMessage += `• <b>Action:</b> <code>${alert.direction}</code>\n`;
            
            if (alert.target) telegramMessage += `• <b>Target:</b> ₹${alert.target.toFixed(2)}\n`;
            if (alert.stopLoss) telegramMessage += `• <b>Stop Loss:</b> ₹${alert.stopLoss.toFixed(2)}\n`;
            
            if (alert.pointA && alert.pointB) {
                telegramMessage += `• <b>A (Low/High):</b> ₹${alert.pointA.price.toFixed(2)} (RSI: ${alert.pointA.rsi.toFixed(1)})\n`;
                telegramMessage += `• <b>B (Low/High):</b> ₹${alert.pointB.price.toFixed(2)} (RSI: ${alert.pointB.rsi.toFixed(1)})\n`;
                telegramMessage += `• <b>Bars Distance:</b> ${alert.barsDistance}\n`;
            }
            if (alert.barsAgo) {
                telegramMessage += `• <b>Trigger Candlestick:</b> ${alert.barsAgo} bars ago (High: ₹${alert.triggerPrice.toFixed(2)})\n`;
            }
            telegramMessage += `\n`;
        });
    }

    console.log("\nFormatted message for Telegram:");
    console.log(telegramMessage);

    console.log("\nSending alert to Telegram...");
    try {
        await sendTelegramMessage(telegramMessage);
        console.log("Telegram alert sent successfully!");
    } catch (err) {
        console.error("Failed to send Telegram alert.");
    }
}

// Run the script
runScanner();
