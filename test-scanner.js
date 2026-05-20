const { calculateIndicators } = require('./indicator-utils');
const { scanPRD, scanRangeShiftDivergence, scanOneRedGreen } = require('./strategies');

function generateMockCandles() {
    const candles = [];
    const baseDate = new Date('2026-01-01');

    // Let's generate 40 candles of an uptrend
    // We will manually inject specific high/low values to trigger patterns.
    for (let i = 0; i < 40; i++) {
        const dateStr = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Base trend is upwards
        let open = 100 + i * 1.5;
        let close = open + (i % 2 === 0 ? 2 : -0.5);
        let low = Math.min(open, close) - 0.5;
        let high = Math.max(open, close) + 0.5;

        candles.push({
            date: dateStr,
            open,
            high,
            low,
            close,
            volume: 10000
        });
    }

    return candles;
}

function testOneRed() {
    console.log("\n--- Testing One Red Strategy ---");
    const candles = generateMockCandles();

    // Create a strong uptrend context
    // Index 34: Green
    // Index 35: Green
    // Index 36: Green
    // Index 37: Red (this will be the "One Red")
    // Index 38: Green (inside candle)
    // Index 39: Current candle, breaks high of Index 37

    candles[35] = { date: '2026-02-05', open: 150, high: 155, low: 149, close: 154 };
    candles[36] = { date: '2026-02-06', open: 154, high: 160, low: 153, close: 159 };
    
    // The One Red Candle: open=159, close=156, low=155, high=160
    candles[37] = { date: '2026-02-07', open: 159, high: 160, low: 155, close: 156 };
    
    // Inside candle: stays within 155-160
    candles[38] = { date: '2026-02-08', open: 156, high: 159, low: 156, close: 158 };
    
    // Current candle: breaks above high of 160 (High = 162)
    candles[39] = { date: '2026-02-09', open: 158, high: 162, low: 157, close: 161 };

    // Calculate Indicators
    const analyzed = calculateIndicators(candles);
    
    // Force RSI to be > 55 and Close > EMA to simulate strong uptrend
    analyzed[37].rsi = 65;
    analyzed[37].ema = 145;
    analyzed[39].rsi = 68;
    analyzed[39].ema = 146;

    const alerts = scanOneRedGreen(analyzed);
    console.log("One Red Alerts found:", alerts);
    if (alerts.length > 0 && alerts[0].strategy === 'OneRed') {
        console.log("\x1b[32mOne Red Test Passed!\x1b[0m");
    } else {
        console.log("\x1b[31mOne Red Test Failed!\x1b[0m");
    }
}

function testPRD() {
    console.log("\n--- Testing 7-Star PRD Strategy ---");
    const candles = generateMockCandles();

    // We need:
    // Point A (e.g. index 30): Pivot Low
    // Point B (e.g. index 36): Pivot Low (Distance = 6 bars, which is within 3 to 10)
    
    // Setup A at index 30
    candles[28] = { date: '2026-01-29', open: 120, high: 122, low: 119, close: 121 };
    candles[29] = { date: '2026-01-30', open: 121, high: 123, low: 120, close: 122 };
    candles[30] = { date: '2026-01-31', open: 122, high: 124, low: 115, close: 123 }; // Point A low = 115
    candles[31] = { date: '2026-02-01', open: 123, high: 125, low: 122, close: 124 };
    candles[32] = { date: '2026-02-02', open: 124, high: 126, low: 123, close: 125 };

    // Setup swing high X between A and B (e.g. index 33)
    candles[33] = { date: '2026-02-03', open: 125, high: 135, low: 124, close: 130 }; // Swing High X = 135

    // Setup B at index 36
    candles[34] = { date: '2026-02-04', open: 130, high: 132, low: 129, close: 131 };
    candles[35] = { date: '2026-02-05', open: 131, high: 133, low: 130, close: 132 };
    candles[36] = { date: '2026-02-06', open: 132, high: 134, low: 120, close: 133 }; // Point B low = 120
    candles[37] = { date: '2026-02-07', open: 133, high: 135, low: 132, close: 134 };
    candles[38] = { date: '2026-02-08', open: 134, high: 136, low: 133, close: 135 };

    // Calculate Indicators
    const analyzed = calculateIndicators(candles);

    // Mock RSI values
    analyzed[30].rsi = 75;
    analyzed[36].rsi = 65;

    // Run Scan
    const alerts = scanPRD(analyzed);
    console.log("PRD Alerts found:", alerts);
    if (alerts.length > 0 && alerts[0].rating === 7) {
        console.log("\x1b[32m7-Star PRD Test Passed!\x1b[0m");
    } else {
        console.log("\x1b[31m7-Star PRD Test Failed!\x1b[0m");
    }
}

testOneRed();
testPRD();
