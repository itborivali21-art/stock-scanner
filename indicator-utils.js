const { RSI, EMA } = require('technicalindicators');

/**
 * Calculates EMA and RSI for the given candles and appends them.
 * Candles should be sorted from oldest to newest.
 * Each candle should have: date, open, high, low, close, volume.
 */
function calculateIndicators(candles) {
    if (candles.length < 20) {
        return candles;
    }

    const closes = candles.map(c => c.close);

    // Calculate RSI (14)
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    // Calculate EMA (20)
    const emaValues = EMA.calculate({ values: closes, period: 20 });

    // Since technicalindicators returns arrays that are shorter than input, 
    // we need to pad them with nulls at the start.
    const rsiPadding = candles.length - rsiValues.length;
    const emaPadding = candles.length - emaValues.length;

    for (let i = 0; i < candles.length; i++) {
        candles[i].rsi = i >= rsiPadding ? rsiValues[i - rsiPadding] : null;
        candles[i].ema = i >= emaPadding ? emaValues[i - emaPadding] : null;
    }

    return candles;
}

/**
 * Finds Pivot Lows in the candles.
 * A candle at index `i` is a pivot low if its low is less than the lows of 
 * `left` candles before it and `right` candles after it.
 */
function getPivotLows(candles, left = 2, right = 1) {
    const pivotIndices = [];
    for (let i = left; i < candles.length - right; i++) {
        const currentLow = candles[i].low;
        let isPivot = true;

        // Check left neighbors
        for (let j = 1; j <= left; j++) {
            if (candles[i - j].low <= currentLow) {
                isPivot = false;
                break;
            }
        }

        // Check right neighbors
        if (isPivot) {
            for (let j = 1; j <= right; j++) {
                if (candles[i + j].low < currentLow) { // Use < instead of <= to handle flat bottoms on right
                    isPivot = false;
                    break;
                }
            }
        }

        if (isPivot && candles[i].rsi !== null) {
            pivotIndices.push(i);
        }
    }
    return pivotIndices;
}

/**
 * Finds Pivot Highs in the candles.
 */
function getPivotHighs(candles, left = 2, right = 1) {
    const pivotIndices = [];
    for (let i = left; i < candles.length - right; i++) {
        const currentHigh = candles[i].high;
        let isPivot = true;

        // Check left neighbors
        for (let j = 1; j <= left; j++) {
            if (candles[i - j].high >= currentHigh) {
                isPivot = false;
                break;
            }
        }

        // Check right neighbors
        if (isPivot) {
            for (let j = 1; j <= right; j++) {
                if (candles[i + j].high > currentHigh) {
                    isPivot = false;
                    break;
                }
            }
        }

        if (isPivot && candles[i].rsi !== null) {
            pivotIndices.push(i);
        }
    }
    return pivotIndices;
}

module.exports = {
    calculateIndicators,
    getPivotLows,
    getPivotHighs
};
