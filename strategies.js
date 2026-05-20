const { getPivotLows, getPivotHighs } = require('./indicator-utils');

/**
 * Scan for 7-Star and 5-Star PRD / NRD (Positive/Negative Reversal Divergence).
 * Returns array of active alerts.
 */
function scanPRD(candles) {
    if (candles.length < 30) return [];

    const alerts = [];
    const n = candles.length;

    // We search for Pivot Lows for PRD (Bullish Reversal Divergence)
    // left=2, right=1 means a pivot low is confirmed 1 bar after it forms
    const pivotLows = getPivotLows(candles, 2, 1);
    
    if (pivotLows.length >= 2) {
        // Point B (the most recent pivot low)
        const B = pivotLows[pivotLows.length - 1];
        
        // We only trigger alerts if B is recent (within the last 3 bars, meaning the confirmation happened recently)
        if (n - 1 - B <= 3) {
            // Check previous pivot lows A
            for (let k = pivotLows.length - 2; k >= 0; k--) {
                const A = pivotLows[k];
                const distance = B - A;
                
                // Rules:
                // 1. Distance between 3 and 10 bars
                if (distance >= 3 && distance <= 10) {
                    const priceA = candles[A].low;
                    const priceB = candles[B].low;
                    const rsiA = candles[A].rsi;
                    const rsiB = candles[B].rsi;
                    
                    // 2. Price makes Higher Low: Low(B) > Low(A)
                    // 3. RSI makes Lower Low: RSI(B) < RSI(A)
                    if (priceB > priceA && rsiB < rsiA) {
                        let starRating = 5; // Default is 5-star
                        
                        // 7-Star condition: both RSI values above 60
                        if (rsiA > 60 && rsiB > 60) {
                            starRating = 7;
                        } else if (rsiA > 40 && rsiB > 40) {
                            starRating = 5;
                        } else {
                            starRating = 3; // Normal PRD
                        }
                        
                        // Find the swing high (Point X) between A and B
                        let swingHighIndex = A + 1;
                        for (let j = A + 1; j < B; j++) {
                            if (candles[j].high > candles[swingHighIndex].high) {
                                swingHighIndex = j;
                            }
                        }
                        const priceX = candles[swingHighIndex].high;
                        
                        // Target = High(X) + (Low(B) - Low(A))
                        const target = priceX + (priceB - priceA);
                        const stopLoss = priceB;
                        
                        alerts.push({
                            strategy: 'PRD',
                            name: `${starRating}-Star Positive Reversal Divergence`,
                            rating: starRating,
                            direction: 'BUY',
                            pointA: { date: candles[A].date, price: priceA, rsi: rsiA },
                            pointB: { date: candles[B].date, price: priceB, rsi: rsiB },
                            swingHigh: { date: candles[swingHighIndex].date, price: priceX },
                            target: target,
                            stopLoss: stopLoss,
                            barsDistance: distance
                        });
                        break; // Stop looking for A once we find the closest valid one
                    }
                }
            }
        }
    }

    // Search for Pivot Highs for NRD (Negative Reversal Divergence)
    const pivotHighs = getPivotHighs(candles, 2, 1);
    if (pivotHighs.length >= 2) {
        const B = pivotHighs[pivotHighs.length - 1];
        
        if (n - 1 - B <= 3) {
            for (let k = pivotHighs.length - 2; k >= 0; k--) {
                const A = pivotHighs[k];
                const distance = B - A;
                
                if (distance >= 3 && distance <= 10) {
                    const priceA = candles[A].high;
                    const priceB = candles[B].high;
                    const rsiA = candles[A].rsi;
                    const rsiB = candles[B].rsi;
                    
                    // Price makes Lower High: High(B) < High(A)
                    // RSI makes Higher High: RSI(B) > RSI(A)
                    if (priceB < priceA && rsiB > rsiA) {
                        let starRating = 5;
                        
                        // 7-Star condition: both RSI values below 40
                        if (rsiA < 40 && rsiB < 40) {
                            starRating = 7;
                        } else if (rsiA < 60 && rsiB < 60) {
                            starRating = 5;
                        } else {
                            starRating = 3;
                        }
                        
                        // Find the swing low (Point X) between A and B
                        let swingLowIndex = A + 1;
                        for (let j = A + 1; j < B; j++) {
                            if (candles[j].low < candles[swingLowIndex].low) {
                                swingLowIndex = j;
                            }
                        }
                        const priceX = candles[swingLowIndex].low;
                        
                        // Target = Low(X) - (High(A) - High(B))
                        const target = priceX - (priceA - priceB);
                        const stopLoss = priceB;
                        
                        alerts.push({
                            strategy: 'NRD',
                            name: `${starRating}-Star Negative Reversal Divergence`,
                            rating: starRating,
                            direction: 'SELL',
                            pointA: { date: candles[A].date, price: priceA, rsi: rsiA },
                            pointB: { date: candles[B].date, price: priceB, rsi: rsiB },
                            swingLow: { date: candles[swingLowIndex].date, price: priceX },
                            target: target,
                            stopLoss: stopLoss,
                            barsDistance: distance
                        });
                        break;
                    }
                }
            }
        }
    }

    return alerts;
}

/**
 * Scan for Range Shift + Divergence (Major Top/Bottom Reversal).
 */
function scanRangeShiftDivergence(candles) {
    if (candles.length < 30) return [];

    const alerts = [];
    const n = candles.length;

    // Bullish Reversal (Major Bottom): Regular Bullish Divergence + Range Shift at 40
    const pivotLows = getPivotLows(candles, 2, 1);
    if (pivotLows.length >= 2) {
        const B = pivotLows[pivotLows.length - 1];
        
        if (n - 1 - B <= 3) {
            for (let k = pivotLows.length - 2; k >= 0; k--) {
                const A = pivotLows[k];
                const distance = B - A;
                
                // Allow longer range for major bottom (5 to 30 bars)
                if (distance >= 5 && distance <= 30) {
                    const priceA = candles[A].low;
                    const priceB = candles[B].low;
                    const rsiA = candles[A].rsi;
                    const rsiB = candles[B].rsi;
                    
                    // Regular Bullish Divergence: Price(B) < Price(A) and RSI(B) > RSI(A)
                    if (priceB < priceA && rsiB > rsiA) {
                        // Range Shift Support Condition: RSI B takes support at 40 (e.g. 38 to 46) 
                        // while RSI A was in bearish zone (RSI A < 40)
                        if (rsiB >= 38 && rsiB <= 46 && rsiA < 40) {
                            // Target: swing high between A and B
                            let swingHighIndex = A + 1;
                            for (let j = A + 1; j < B; j++) {
                                if (candles[j].high > candles[swingHighIndex].high) {
                                    swingHighIndex = j;
                                }
                            }
                            const target = candles[swingHighIndex].high;
                            const stopLoss = priceB;
                            
                            alerts.push({
                                strategy: 'RangeShiftDivergence_Bottom',
                                name: 'Bullish Range Shift + Divergence (Major Bottom)',
                                direction: 'BUY',
                                pointA: { date: candles[A].date, price: priceA, rsi: rsiA },
                                pointB: { date: candles[B].date, price: priceB, rsi: rsiB },
                                target: target,
                                stopLoss: stopLoss,
                                barsDistance: distance
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    // Bearish Reversal (Major Top): Regular Bearish Divergence + Range Shift at 60
    const pivotHighs = getPivotHighs(candles, 2, 1);
    if (pivotHighs.length >= 2) {
        const B = pivotHighs[pivotHighs.length - 1];
        
        if (n - 1 - B <= 3) {
            for (let k = pivotHighs.length - 2; k >= 0; k--) {
                const A = pivotHighs[k];
                const distance = B - A;
                
                if (distance >= 5 && distance <= 30) {
                    const priceA = candles[A].high;
                    const priceB = candles[B].high;
                    const rsiA = candles[A].rsi;
                    const rsiB = candles[B].rsi;
                    
                    // Regular Bearish Divergence: Price(B) > Price(A) and RSI(B) < RSI(A)
                    if (priceB > priceA && rsiB < rsiA) {
                        // Range Shift Resistance Condition: RSI B encounters resistance at 60 (e.g. 54 to 62)
                        // while RSI A was in bullish zone (RSI A > 60)
                        if (rsiB >= 54 && rsiB <= 62 && rsiA > 60) {
                            // Target: swing low between A and B
                            let swingLowIndex = A + 1;
                            for (let j = A + 1; j < B; j++) {
                                if (candles[j].low < candles[swingLowIndex].low) {
                                    swingLowIndex = j;
                                }
                            }
                            const target = candles[swingLowIndex].low;
                            const stopLoss = priceB;
                            
                            alerts.push({
                                strategy: 'RangeShiftDivergence_Top',
                                name: 'Bearish Range Shift + Divergence (Major Top)',
                                direction: 'SELL',
                                pointA: { date: candles[A].date, price: priceA, rsi: rsiA },
                                pointB: { date: candles[B].date, price: priceB, rsi: rsiB },
                                target: target,
                                stopLoss: stopLoss,
                                barsDistance: distance
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    return alerts;
}

/**
 * Scan for One Red (Bullish) and One Green (Bearish) continuation signals.
 */
function scanOneRedGreen(candles) {
    if (candles.length < 30) return [];

    const alerts = [];
    const n = candles.length;
    const current = candles[n - 1];

    // Scan for One Red (Bullish continuation)
    // Look back at most 5 bars for the single Red candle
    for (let r = n - 2; r >= n - 6; r--) {
        if (r < 4) break;
        const candleR = candles[r];
        
        // 1. Must be a red candle (Close < Open)
        if (candleR.close < candleR.open) {
            // 2. Strong uptrend context at the red candle
            const isUptrend = candleR.rsi > 53 && candleR.close > candleR.ema;
            
            // 3. Must be preceded by green candles (at least 2 of previous 3 are green)
            let greenCount = 0;
            for (let j = 1; j <= 3; j++) {
                if (candles[r - j].close > candles[r - j].open) greenCount++;
            }
            const isPrecededByGreen = greenCount >= 2;
            const singleRed = (candles[r - 1].close > candles[r - 1].open); // R-1 is green
            
            if (isUptrend && isPrecededByGreen && singleRed) {
                // 4. Inside candles check: candles between R and current (indices R+1 to n-2)
                // must not break the low of R, and must stay mostly within R's range
                let isInside = true;
                for (let j = r + 1; j <= n - 2; j++) {
                    if (candles[j].low < candleR.low || candles[j].high > candleR.high) {
                        isInside = false;
                        break;
                    }
                }
                
                if (isInside) {
                    // 5. Trigger: Current candle high crosses high of R
                    if (current.high > candleR.high && current.low >= candleR.low) {
                        // Target calculation: 1.5x risk reward based on stop loss at candleR.low
                        const risk = candleR.high - candleR.low;
                        const target = current.close + (risk * 1.5);
                        
                        alerts.push({
                            strategy: 'OneRed',
                            name: 'One Red Technique (Bullish Continuation)',
                            direction: 'BUY',
                            triggerDate: candleR.date,
                            triggerPrice: candleR.high,
                            stopLoss: candleR.low,
                            target: target,
                            barsAgo: n - 1 - r
                        });
                        break; // Only report the most recent setup
                    }
                }
            }
        }
    }

    // Scan for One Green (Bearish continuation)
    for (let g = n - 2; g >= n - 6; g--) {
        if (g < 4) break;
        const candleG = candles[g];
        
        if (candleG.close > candleG.open) {
            const isDowntrend = candleG.rsi < 47 && candleG.close < candleG.ema;
            
            let redCount = 0;
            for (let j = 1; j <= 3; j++) {
                if (candles[g - j].close < candles[g - j].open) redCount++;
            }
            const isPrecededByRed = redCount >= 2;
            const singleGreen = (candles[g - 1].close < candles[g - 1].open);
            
            if (isDowntrend && isPrecededByRed && singleGreen) {
                let isInside = true;
                for (let j = g + 1; j <= n - 2; j++) {
                    if (candles[j].high > candleG.high || candles[j].low < candleG.low) {
                        isInside = false;
                        break;
                    }
                }
                
                if (isInside) {
                    if (current.low < candleG.low && current.high <= candleG.high) {
                        const risk = candleG.high - candleG.low;
                        const target = current.close - (risk * 1.5);
                        
                        alerts.push({
                            strategy: 'OneGreen',
                            name: 'One Green Technique (Bearish Continuation)',
                            direction: 'SELL',
                            triggerDate: candleG.date,
                            triggerPrice: candleG.low,
                            stopLoss: candleG.high,
                            target: target,
                            barsAgo: n - 1 - g
                        });
                        break;
                    }
                }
            }
        }
    }

    return alerts;
}

module.exports = {
    scanPRD,
    scanRangeShiftDivergence,
    scanOneRedGreen
};
