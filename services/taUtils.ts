import type { BybitTrade, ERIReport, MCIReport, MSIReport, ProcessedKline } from '../types';

// UTILITY FUNCTIONS
export const safeRound = (value: number | undefined | null, decimals: number): number | null => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        return null;
    }
    return Number(value.toFixed(decimals));
};

export const getMarketRegime = (adx: number | null | undefined): string => {
    if (adx === null || adx === undefined || isNaN(adx)) {
        return "Weak Trend / Chop";
    }
    if (adx > 25) {
        return "Trending";
    }
    if (adx < 20) {
        return "Ranging";
    }
    return "Weak Trend / Chop";
};

// HELPER FUNCTIONS for TA
const calculateTrueRange = (highs: number[], lows: number[], closes: number[]): number[] => {
    const tr: number[] = [highs.length > 0 ? highs[0] - lows[0] : 0];
    for (let i = 1; i < highs.length; i++) {
        const tr1 = highs[i] - lows[i];
        const tr2 = Math.abs(highs[i] - closes[i - 1]);
        const tr3 = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(tr1, tr2, tr3));
    }
    return tr;
};

const calculateDirectionalMovement = (highs: number[], lows: number[]) => {
    const dm_plus: number[] = [0];
    const dm_minus: number[] = [0];
    for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        dm_plus.push(upMove > downMove && upMove > 0 ? upMove : 0);
        dm_minus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    return { dm_plus, dm_minus };
};

const WilderSmoothing = (data: number[], period: number): number[] => {
    const smoothed = new Array(data.length).fill(0);
    if (data.length < period) return smoothed;

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    smoothed[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
        smoothed[i] = smoothed[i - 1] - (smoothed[i - 1] / period) + data[i];
    }
    return smoothed;
};


// EXPORTED TA FUNCTIONS

export const analyze_volume_profile = (df: ProcessedKline[], bins = 50) => {
    if (df.length === 0) return { error: "Empty data" };
    const min_low = Math.min(...df.map(d => d.low));
    const max_high = Math.max(...df.map(d => d.high));
    if (max_high === min_low) return { error: "No price range" };

    const bin_size = (max_high - min_low) / bins;
    const volume_bins: { [key: number]: number } = {};
    for (let i = 0; i < bins; i++) volume_bins[min_low + i * bin_size] = 0;

    df.forEach(d => {
        const bin = Math.floor((d.close - min_low) / bin_size);
        const bin_start = min_low + bin * bin_size;
        if (volume_bins[bin_start] !== undefined) {
            volume_bins[bin_start] += d.volume;
        }
    });

    const poc = parseFloat(Object.keys(volume_bins).reduce((a, b) => volume_bins[parseFloat(a)] > volume_bins[parseFloat(b)] ? a : b));
    const total_volume = Object.values(volume_bins).reduce((s, v) => s + v, 0);
    const target_volume = total_volume * 0.7;

    const sorted_bins = Object.entries(volume_bins).sort(([, vA], [, vB]) => vB - vA);
    let cumulative_volume = 0;
    const value_area_bins = [];
    for (const [price, volume] of sorted_bins) {
        if (cumulative_volume > target_volume) break;
        cumulative_volume += volume;
        value_area_bins.push(parseFloat(price));
    }

    const vah = Math.max(...value_area_bins);
    const val = Math.min(...value_area_bins);
    const last_price = df[df.length - 1].close;

    return {
        point_of_control_poc: safeRound(poc, 5),
        value_area_high_vah: safeRound(vah, 5),
        value_area_low_val: safeRound(val, 5),
        price_position_vs_va: last_price > vah ? "Above Value Area (Bullish)" : last_price < val ? "Below Value Area (Bearish)" : "Inside Value Area (Neutral)"
    };
};

export const calculatePearsonCorrelation = (dataX: number[], dataY: number[]): number | null => {
    if (dataX.length !== dataY.length || dataX.length === 0) {
        return null;
    }

    const n = dataX.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
        const x = dataX[i];
        const y = dataY[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        sumY2 += y * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
        return 0;
    }

    return numerator / denominator;
};


export const calculateSMA = (data: number[], period: number): (number | null)[] => {
    if (data.length < period) return new Array(data.length).fill(null);
    const sma: (number | null)[] = new Array(period - 1).fill(null);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    sma.push(sum / period);
    for (let i = period; i < data.length; i++) {
        sum = sum - data[i - period] + data[i];
        sma.push(sum / period);
    }
    return sma;
};

export const calculateEMA = (data: number[], period: number): (number | null)[] => {
    if (data.length < period) return new Array(data.length).fill(null);
    const ema: (number | null)[] = new Array(period - 1).fill(null);
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    let prevEma = sum / period;
    ema.push(prevEma);
    for (let i = period; i < data.length; i++) {
        const newEma = (data[i] - prevEma) * k + prevEma;
        ema.push(newEma);
        prevEma = newEma;
    }
    return ema;
};

export const calculateRSI = (data: number[], period: number): (number | null)[] => {
    if (data.length <= period) return new Array(data.length).fill(null);

    const rsi: (number | null)[] = new Array(period).fill(null);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses -= change;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        let currentGain = change > 0 ? change : 0;
        let currentLoss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
        
        rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
};

export const calculateBB = (data: number[], period: number, stdDev: number) => {
    const sma = calculateSMA(data, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    const bandwidth: (number | null)[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1 || sma[i] === null) {
            upper.push(null);
            lower.push(null);
            bandwidth.push(null);
            continue;
        }
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i]!;
        const variance = slice.reduce((acc, val) => acc + (val - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);
        const up = mean + stdDev * sd;
        const low = mean - stdDev * sd;
        upper.push(up);
        lower.push(low);
        bandwidth.push(mean > 0 ? ((up - low) / mean) * 100 : 0);
    }
    return { upper, middle: sma, lower, bandwidth };
};

export const calculateADX = (highs: number[], lows: number[], closes: number[], period: number): ({ adx: number | null, pdi: number | null, mdi: number | null }[]) => {
    if (highs.length <= period * 2) {
        return Array.from({ length: highs.length }, () => ({ adx: null, pdi: null, mdi: null }));
    }

    const { dm_plus, dm_minus } = calculateDirectionalMovement(highs, lows);
    const tr = calculateTrueRange(highs, lows, closes);
    
    const smoothed_dm_plus = WilderSmoothing(dm_plus, period);
    const smoothed_dm_minus = WilderSmoothing(dm_minus, period);
    const smoothed_tr = WilderSmoothing(tr, period);

    const di_plus: (number | null)[] = [];
    const di_minus: (number | null)[] = [];
    const dx: (number | null)[] = [];

    for (let i = 0; i < smoothed_tr.length; i++) {
        if (i < period - 1) {
             di_plus.push(null);
             di_minus.push(null);
             dx.push(null);
             continue;
        }
        
        const pdi = smoothed_tr[i] === 0 ? 0 : (smoothed_dm_plus[i] / smoothed_tr[i]) * 100;
        const mdi = smoothed_tr[i] === 0 ? 0 : (smoothed_dm_minus[i] / smoothed_tr[i]) * 100;
        di_plus.push(pdi);
        di_minus.push(mdi);
        
        const dx_val = (pdi + mdi) === 0 ? 0 : (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
        dx.push(dx_val);
    }
    
    const adx: (number|null)[] = new Array(period * 2 - 2).fill(null);
    if(dx.length >= period * 2 -1) {
        let sum = 0;
        for (let i = period - 1; i < period * 2 - 2; i++) {
            sum += dx[i]!;
        }
        adx.push(sum / period);

        for (let i = period * 2 - 1; i < dx.length; i++) {
            const currentAdx = ((adx[i-1]! * (period - 1)) + dx[i]!) / period;
            adx.push(currentAdx);
        }
    }
    
    return highs.map((_, i) => ({
        adx: adx[i] ?? null,
        pdi: di_plus[i] ?? null,
        mdi: di_minus[i] ?? null
    }));
};


export const calculateOBV = (closes: number[], volumes: number[]): number[] => {
    const obv: number[] = [0];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
            obv.push(obv[i - 1] + volumes[i]);
        } else if (closes[i] < closes[i - 1]) {
            obv.push(obv[i - 1] - volumes[i]);
        } else {
            obv.push(obv[i - 1]);
        }
    }
    return obv;
};

export const calculateIchimoku = (highs: number[], lows: number[], options: { tenkanPeriod?: number, kijunPeriod?: number, senkouBPeriod?: number }) => {
    const tenkanPeriod = options.tenkanPeriod ?? 9;
    const kijunPeriod = options.kijunPeriod ?? 26;
    const senkouBPeriod = options.senkouBPeriod ?? 52;
    const senkouLag = kijunPeriod;

    const tenkan: (number|null)[] = [];
    const kijun: (number|null)[] = [];
    const senkouA: (number|null)[] = [];
    const senkouB: (number|null)[] = [];

    for (let i = 0; i < highs.length; i++) {
        if (i >= tenkanPeriod - 1) {
            const periodHigh = Math.max(...highs.slice(i - tenkanPeriod + 1, i + 1));
            const periodLow = Math.min(...lows.slice(i - tenkanPeriod + 1, i + 1));
            tenkan.push((periodHigh + periodLow) / 2);
        } else {
            tenkan.push(null);
        }

        if (i >= kijunPeriod - 1) {
            const periodHigh = Math.max(...highs.slice(i - kijunPeriod + 1, i + 1));
            const periodLow = Math.min(...lows.slice(i - kijunPeriod + 1, i + 1));
            kijun.push((periodHigh + periodLow) / 2);
        } else {
            kijun.push(null);
        }
        
        if (tenkan[i] !== null && kijun[i] !== null) {
            senkouA.push((tenkan[i]! + kijun[i]!) / 2);
        } else {
            senkouA.push(null);
        }

        if (i >= senkouBPeriod - 1) {
            const periodHigh = Math.max(...highs.slice(i - senkouBPeriod + 1, i + 1));
            const periodLow = Math.min(...lows.slice(i - senkouBPeriod + 1, i + 1));
            senkouB.push((periodHigh + periodLow) / 2);
        } else {
            senkouB.push(null);
        }
    }
    
    const shiftedSenkouA = new Array(senkouLag).fill(null).concat(senkouA.slice(0, -senkouLag));
    const shiftedSenkouB = new Array(senkouLag).fill(null).concat(senkouB.slice(0, -senkouLag));

    return { tenkan, kijun, senkouA: shiftedSenkouA, senkouB: shiftedSenkouB };
};

export const calculateKC = (highs: number[], lows: number[], closes: number[], period: number, multiplier: number) => {
    const ema = calculateEMA(closes, period);
    const tr = calculateTrueRange(highs, lows, closes);
    const atr = calculateEMA(tr, period);

    const upper: (number|null)[] = [];
    const lower: (number|null)[] = [];
    
    for (let i = 0; i < closes.length; i++) {
        if (ema[i] !== null && atr[i] !== null) {
            upper.push(ema[i]! + multiplier * atr[i]!);
            lower.push(ema[i]! - multiplier * atr[i]!);
        } else {
            upper.push(null);
            lower.push(null);
        }
    }

    return { upper, middle: ema, lower };
};

export const detect_divergence = (df: ProcessedKline[], indicator: (number | null)[], indicator_name: string, lookback = 20) => {
    if (df.length < lookback || indicator.length < lookback) {
        return "N/A";
    }

    const prices = df.map(d => d.close).slice(-lookback);
    const indicators = indicator.slice(-lookback);
    
    const findPivots = (data: (number|null)[], isHigh: boolean) => {
        const pivots = [];
        for (let i = 1; i < data.length - 1; i++) {
            const val = data[i];
            const prev = data[i-1];
            const next = data[i+1];
            if(val === null || prev === null || next === null) continue;
            if (isHigh && val > prev && val > next) pivots.push({ index: i, value: val });
            if (!isHigh && val < prev && val < next) pivots.push({ index: i, value: val });
        }
        return pivots;
    }

    const priceHighs = findPivots(prices, true);
    const indicatorHighs = findPivots(indicators, true);
    if(priceHighs.length >= 2 && indicatorHighs.length >= 2) {
        const lastPriceHigh = priceHighs[priceHighs.length - 1];
        const prevPriceHigh = priceHighs[priceHighs.length - 2];
        const lastIndicatorHigh = indicatorHighs[indicatorHighs.length - 1];
        const prevIndicatorHigh = indicatorHighs[indicatorHighs.length - 2];

        if (lastPriceHigh.value > prevPriceHigh.value && lastIndicatorHigh.value < prevIndicatorHigh.value) {
            return `Regular Bearish Divergence on ${indicator_name}`;
        }
         if (lastPriceHigh.value < prevPriceHigh.value && lastIndicatorHigh.value > prevPriceHigh.value) {
            return `Hidden Bearish Divergence on ${indicator_name}`;
        }
    }
    
    const priceLows = findPivots(prices, false);
    const indicatorLows = findPivots(indicators, false);
    if(priceLows.length >= 2 && indicatorLows.length >= 2) {
        const lastPriceLow = priceLows[priceLows.length - 1];
        const prevPriceLow = priceLows[priceLows.length - 2];
        const lastIndicatorLow = indicatorLows[indicatorLows.length - 1];
        const prevIndicatorLow = indicatorLows[indicatorLows.length - 2];

        if (lastPriceLow.value < prevPriceLow.value && lastIndicatorLow.value > prevIndicatorLow.value) {
            return `Regular Bullish Divergence on ${indicator_name}`;
        }
        if (lastPriceLow.value > prevPriceLow.value && lastIndicatorLow.value < prevIndicatorLow.value) {
            return `Hidden Bullish Divergence on ${indicator_name}`;
        }
    }

    return "No significant divergence detected";
};

export const calculate_vwap_deviation_ratio = (df: ProcessedKline[], period: number): (number|null)[] => {
    const vwap_dev: (number | null)[] = [];
    for (let i = 0; i < df.length; i++) {
        if (i < period - 1) {
            vwap_dev.push(null);
            continue;
        }
        const period_df = df.slice(i - period + 1, i + 1);
        let cumulative_tp_vol = 0;
        let cumulative_vol = 0;
        period_df.forEach((d: { high: number; low: number; close: number; volume: number; }) => {
            const typical_price = (d.high + d.low + d.close) / 3;
            cumulative_tp_vol += typical_price * d.volume;
            cumulative_vol += d.volume;
        });
        const vwap = cumulative_vol > 0 ? cumulative_tp_vol / cumulative_vol : 0;
        const last_close = period_df[period_df.length - 1].close;
        vwap_dev.push(vwap > 0 ? (last_close / vwap - 1) * 100 : null);
    }
    return vwap_dev;
};

export const calculate_fractal_efficiency_ratio = (df: ProcessedKline[], period: number): (number|null)[] => {
    const fer: (number | null)[] = [];
    for (let i = 0; i < df.length; i++) {
        if (i < period) {
            fer.push(null);
            continue;
        }
        const price_change = Math.abs(df[i].close - df[i - period].close);
        let path_length = 0;
        for (let j = i - period + 1; j <= i; j++) {
            path_length += Math.abs(df[j].close - df[j - 1].close);
        }
        fer.push(path_length > 0 ? price_change / path_length : null);
    }
    return fer;
};

export const calculate_mfi_v = (df: ProcessedKline[], rsi: (number | null)[], adx: ({ adx: number | null })[]): (number|null)[] => {
    const mfi_v: (number | null)[] = [];
    for (let i = 0; i < df.length; i++) {
        const rsi_val = rsi[i];
        const adx_val = adx[i]?.adx;
        if (rsi_val !== null && adx_val !== null) {
            mfi_v.push((rsi_val - 50) * (adx_val / 50)); // Scaled for more impact
        } else {
            mfi_v.push(null);
        }
    }
    return mfi_v;
};

export const calculate_vpe = (df: ProcessedKline[], bbw: (number | null)[], adx: ({ adx: number | null })[]): (number|null)[] => {
    const vpe: (number | null)[] = [];
    const valid_bbw = bbw.filter(v => v !== null) as number[];
    if (valid_bbw.length === 0) return new Array(df.length).fill(null);
    const min_bbw = Math.min(...valid_bbw);
    const max_bbw = Math.max(...valid_bbw);
    
    for (let i = 0; i < df.length; i++) {
        const bbw_val = bbw[i];
        const adx_val = adx[i]?.adx;
        if (bbw_val !== null && adx_val !== null) {
            const norm_bbw = max_bbw > min_bbw ? 1 - ((bbw_val - min_bbw) / (max_bbw - min_bbw)) : 0;
            const norm_adx = adx_val < 25 ? (25 - adx_val) / 25 : 0;
            vpe.push(norm_bbw * norm_adx * 100);
        } else {
            vpe.push(null);
        }
    }
    return vpe;
};

// NEW: Chimera Regime Filter (CRF)
export const calculateCRF = (
    adx: number | null, 
    bbw: number | null, 
    fer: number | null, 
    ema50: number | null, 
    ema200: number | null, 
    bbw_history: (number|null)[]
): string => {
    if (adx === null || bbw === null || fer === null || ema50 === null || ema200 === null) {
        return "Indeterminate";
    }

    const scores: Record<string, number> = {
        trend: 0,
        range: 0,
        squeeze: 0,
        chop: 0,
    };

    const direction = ema50 > ema200 ? 'Bullish' : 'Bearish';

    // 1. Score ADX (Trend Strength)
    if (adx > 25) scores.trend += 2;
    if (adx < 20) scores.range += 2;
    if (adx >= 20 && adx <= 25) scores.chop += 1;

    // 2. Score BBW (Volatility)
    const recent_bbw_history = bbw_history.filter(v => v !== null).slice(-50) as number[];
    if (recent_bbw_history.length > 10) {
        const percentile = [...recent_bbw_history].sort((a, b) => a - b);
        const lower_quintile = percentile[Math.floor(percentile.length * 0.2)];
        if (bbw <= lower_quintile) {
            scores.squeeze += 3;
            scores.range += 1; // Squeeze is a form of range
        }
    }

    // 3. Score FER (Trend Efficiency)
    if (fer > 0.6) scores.trend += 2;
    else if (fer < 0.4) scores.chop += 2;
    else {
        scores.range += 1;
        scores.chop += 0.5;
    }

    // 4. Determine Dominant Regime
    if (scores.squeeze >= 3) return "Volatility Squeeze";

    const dominant_score = Math.max(scores.trend, scores.range, scores.chop);
    
    if (dominant_score === scores.trend && dominant_score > 1) {
        if (adx > 35 && fer > 0.5) return `Strong ${direction} Trend`;
        return `Developing ${direction} Trend`;
    }
    
    if (dominant_score === scores.range && dominant_score > 1) {
        return "Stable Range";
    }

    if (dominant_score === scores.chop && dominant_score > 1) {
        return "Choppy Range";
    }

    return "Indeterminate";
};


// NEW: Unification Indices Calculation
export const calculateERI = (recent_trades: BybitTrade[]): ERIReport => {
    if (!recent_trades || recent_trades.length === 0) {
        return { status: "No trade data", interpretation: "N/A", buy_volume: 0, sell_volume: 0, volume_delta: 0, buy_trades: 0, sell_trades: 0, trades_delta: 0, largest_trade_side: 'N/A', largest_trade_size: 0 };
    }

    let buy_volume = 0;
    let sell_volume = 0;
    let buy_trades = 0;
    let sell_trades = 0;
    let largest_trade_size = 0;
    let largest_trade_side: 'Buy' | 'Sell' | 'N/A' = 'N/A';

    recent_trades.forEach(trade => {
        const size = parseFloat(trade.size);
        if (trade.side === 'Buy') {
            buy_volume += size;
            buy_trades++;
        } else {
            sell_volume += size;
            sell_trades++;
        }
        if (size > largest_trade_size) {
            largest_trade_size = size;
            largest_trade_side = trade.side;
        }
    });
    
    const volume_delta = buy_volume - sell_volume;
    const trades_delta = buy_trades - sell_trades;

    let interpretation = "Neutral";
    if (volume_delta > 0 && trades_delta > 0) interpretation = "Bullish: Buyers are more aggressive and numerous.";
    else if (volume_delta < 0 && trades_delta < 0) interpretation = "Bearish: Sellers are more aggressive and numerous.";
    else if (volume_delta > 0 && trades_delta < 0) interpretation = "Bullish Divergence: Fewer buyers absorb more volume (potential absorption).";
    else if (volume_delta < 0 && trades_delta > 0) interpretation = "Bearish Divergence: Fewer sellers distribute more volume (potential distribution).";

    return {
        status: "OK",
        interpretation,
        buy_volume: safeRound(buy_volume, 4),
        sell_volume: safeRound(sell_volume, 4),
        volume_delta: safeRound(volume_delta, 4),
        buy_trades, sell_trades, trades_delta,
        largest_trade_side,
        largest_trade_size: safeRound(largest_trade_size, 4)
    };
};

export const calculateMSI = (adx: number | null, bbw: number | null, fer: number | null, bbw_history: (number|null)[], fer_history: (number|null)[]): MSIReport => {
    const scores: Record<string, number> = { "Stable Trend": 0, "Exhaustion Trend": 0, "Volatile Breakout": 0, "Low-Vol Squeeze": 0, "Choppy Range": 0, "Stable Range": 0 };
    if (adx === null || bbw === null || fer === null) return { dominantState: 'Unknown', probabilities: {} };

    // Normalize history
    const recent_bbw = bbw_history.slice(-20).filter(v => v !== null) as number[];
    const bbw_avg = recent_bbw.length > 0 ? recent_bbw.reduce((s, a) => s + a, 0) / recent_bbw.length : 1;

    // Scoring logic
    if (adx > 25) { // Trending states
        scores["Stable Trend"] += adx / 50;
        if (fer > 0.6) scores["Stable Trend"] += 0.5;
        if (bbw < bbw_avg * 1.2) scores["Stable Trend"] += 0.5;

        scores["Exhaustion Trend"] += adx / 50;
        if (fer < 0.4) scores["Exhaustion Trend"] += 0.5;
        if (bbw > bbw_avg * 1.5) scores["Exhaustion Trend"] += 0.5;
    }
    if (adx > 20 && adx < 35 && bbw > bbw_avg * 2) { // Breakout
        scores["Volatile Breakout"] += (adx / 50) + (bbw / 10);
    }
    if (adx < 20) { // Ranging states
        scores["Choppy Range"] += (25 - adx) / 25;
        if(fer < 0.4) scores["Choppy Range"] += 0.5;

        scores["Stable Range"] += (25 - adx) / 25;
        if(fer > 0.5) scores["Stable Range"] += 0.5;

        if (bbw < bbw_avg * 0.5) scores["Low-Vol Squeeze"] += (1 - bbw / (bbw_avg * 0.5)) + ((25 - adx) / 25);
    }

    // Normalize scores to probabilities
    const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
    const probabilities: Record<string, number> = {};
    let dominantState = "Choppy Range";
    let maxProb = 0;

    if (totalScore > 0) {
        for (const key in scores) {
            const prob = (scores[key] / totalScore) * 100;
            probabilities[key] = safeRound(prob, 1)!;
            if (prob > maxProb) {
                maxProb = prob;
                dominantState = key;
            }
        }
    } else {
        probabilities[dominantState] = 100;
    }
    
    return { dominantState, probabilities };
};

const CANDLES_PER_HOUR: Record<string, number> = {
    '5': 12, '15': 4, '30': 2, '60': 1
};

export const calculateMCI = (df: ProcessedKline[], ema20: (number|null)[], taker_buy_percentage: number | null, funding_rate: number | null, long_short_ratio: number | null, open_interest_delta_4h_pct: number | null, eri_report: ERIReport, timeframe: string): MCIReport => {
    // High-conviction Pattern Matching First
    const last_close = df[df.length-1].close;
    
    const candlesForHour = CANDLES_PER_HOUR[timeframe] || 1; // Default to 1 for 1h and above
    if (df.length < candlesForHour) {
        return { type: "Indeterminate", pattern: null, signal: "Neutral", conviction: 0, reason: "Insufficient data for 1h change calculation." };
    }
    const price_change_pct_1h = ((last_close / df[df.length - candlesForHour].close) - 1) * 100;

    if (price_change_pct_1h > 4 && (funding_rate ?? 0) < 0 && (long_short_ratio ?? 0.5) < 0.8 && (open_interest_delta_4h_pct ?? 0) > 2) {
        return { type: "Pattern", pattern: "Short Squeeze", signal: "Bullish", conviction: 90, reason: "Rapid price increase with negative funding and rising OI suggests shorts are being forced to cover." };
    }
    if (price_change_pct_1h < -4 && (funding_rate ?? 0) > 0 && (long_short_ratio ?? 0.5) > 1.2 && (open_interest_delta_4h_pct ?? 0) > 2) {
        return { type: "Pattern", pattern: "Long Squeeze", signal: "Bearish", conviction: 90, reason: "Rapid price decrease with positive funding and rising OI suggests longs are being forced to sell." };
    }
     if (Math.abs(price_change_pct_1h) < 1.5 && eri_report.interpretation.includes("Bullish Divergence")) {
        return { type: "Pattern", pattern: "Hidden Buying", signal: "Bullish", conviction: 85, reason: "Price is consolidating while large buyers are absorbing sell-side liquidity." };
    }

    // Standard Conviction Calculation
    let conviction = 50; // Base
    let reasons: string[] = [];
    const is_bullish_trend = last_close > (ema20[ema20.length - 1] ?? last_close);

    if (is_bullish_trend) {
        if ((taker_buy_percentage ?? 50) > 52) { conviction += 10; reasons.push("Taker buys dominate."); }
        if ((funding_rate ?? 0) > 0) { conviction += 5; reasons.push("Funding is positive."); }
        if ((long_short_ratio ?? 1) > 1) { conviction += 5; reasons.push("Longs outnumber shorts."); }
        if ((eri_report.volume_delta ?? 0) > 0) { conviction += 10; reasons.push("Volume delta is positive."); }
    } else {
        if ((taker_buy_percentage ?? 50) < 48) { conviction += 10; reasons.push("Taker sells dominate."); }
        if ((funding_rate ?? 0) < 0) { conviction += 5; reasons.push("Funding is negative."); }
        if ((long_short_ratio ?? 1) < 1) { conviction += 5; reasons.push("Shorts outnumber longs."); }
        if ((eri_report.volume_delta ?? 0) < 0) { conviction += 10; reasons.push("Volume delta is negative."); }
    }
    
    // Divergence check
    const rsi_divergence = detect_divergence(df, calculateRSI(df.map(d=>d.close), 14), 'RSI');
    if(/Divergence/.test(rsi_divergence)) {
        conviction = Math.max(10, conviction - 30);
        reasons.push("RSI divergence detected, reducing conviction.");
    }

    conviction = Math.max(0, Math.min(100, conviction)); // Clamp 0-100
    const signal = is_bullish_trend ? 'Bullish' : 'Bearish';

    return { type: "Momentum", pattern: null, signal, conviction, reason: reasons.length > 0 ? reasons.join(' ') : "No strong conviction factors." };
};

// NEW: Advanced Level Calculation Helpers
export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number): (number | null)[] => {
    const tr = calculateTrueRange(highs, lows, closes);
    return calculateEMA(tr, period);
};

export const calculateVWAP = (df: ProcessedKline[], period: number): (number | null)[] => {
    const vwapSeries: (number | null)[] = [];
    for (let i = 0; i < df.length; i++) {
        if (i < period - 1) {
            vwapSeries.push(null);
            continue;
        }
        const period_df = df.slice(i - period + 1, i + 1);
        let cumulative_tp_vol = 0;
        let cumulative_vol = 0;
        period_df.forEach((d: { high: number; low: number; close: number; volume: number; }) => {
            const typical_price = (d.high + d.low + d.close) / 3;
            cumulative_tp_vol += typical_price * d.volume;
            cumulative_vol += d.volume;
        });
        const vwap = cumulative_vol > 0 ? cumulative_tp_vol / cumulative_vol : null;
        vwapSeries.push(vwap);
    }
    return vwapSeries;
};

// --- APEX EXCLUSIVE INDICATORS ---

export const calculateCVD = (df: ProcessedKline[]): { value: number | null; interpretation: string } => {
    if (df.length < 2) return { value: null, interpretation: 'Insufficient data' };

    let cvd = 0;
    for (let i = 1; i < df.length; i++) {
        const price_change = df[i].close - df[i-1].close;
        if (price_change > 0) {
            cvd += df[i].volume;
        } else if (price_change < 0) {
            cvd -= df[i].volume;
        }
    }
    
    let interpretation = "Neutral";
    if (cvd > 0) {
       interpretation = `Bullish (${safeRound(cvd, 2)}): Net buying pressure accumulated.`;
    } else if (cvd < 0) {
       interpretation = `Bearish (${safeRound(cvd, 2)}): Net selling pressure accumulated.`;
    }

    return { value: safeRound(cvd, 2), interpretation };
};

export const calculateHVNMigration = (
    poc_first_half: number | null,
    poc_second_half: number | null
): { status: string; poc_first_half: number | null; poc_second_half: number | null } => {
    if (poc_first_half === null || poc_second_half === null) {
        return { status: "Indeterminate", poc_first_half, poc_second_half };
    }
    const diff_pct = (poc_second_half - poc_first_half) / poc_first_half;

    let status = "Stagnant (Neutral)";
    if (diff_pct > 0.002) { // More than 0.2% up
        status = "Migrating Up (Bullish)";
    } else if (diff_pct < -0.002) { // More than 0.2% down
        status = "Migrating Down (Bearish)";
    }

    return { status, poc_first_half, poc_second_half };
};

export const calculateHVR = (atr_history: (number | null)[], lookback = 100): { rank: number | null; interpretation: string } => {
    const valid_history = atr_history.filter(v => v !== null && v > 0) as number[];
    if (valid_history.length < lookback) {
        return { rank: null, interpretation: 'Insufficient data' };
    }
    
    const recent_history = valid_history.slice(-lookback);
    const current_atr = recent_history[recent_history.length - 1];
    
    const count_lower = recent_history.filter(v => v < current_atr).length;
    const rank = (count_lower / recent_history.length) * 100;
    
    let interpretation = "Medium Volatility";
    if (rank > 90) interpretation = "Extreme Volatility (Exhaustion Risk)";
    else if (rank > 70) interpretation = "High Volatility";
    else if (rank < 10) interpretation = "Extreme Low Volatility (Squeeze Potential)";
    else if (rank < 30) interpretation = "Low Volatility";

    return { rank: safeRound(rank, 0), interpretation };
};