import type { BybitSymbol, FullReport, Kline, DerivativesReport, BybitTrade, MSIReport, MCIReport, KeyLevels, CorrelationReport, ProcessedKline, LiveLiquidation, FearAndGreedIndex, ApexExclusiveIndicators, OrderbookData, LiveTickerData } from '../types';
import { BYBIT_BASE_URL, INTERVALS } from '../constants';
import { calculateADX, calculateBB, calculateEMA, calculateRSI, getMarketRegime, calculate_vwap_deviation_ratio, calculate_fractal_efficiency_ratio, calculate_mfi_v, calculate_vpe, detect_divergence, calculateOBV, calculateIchimoku, calculateKC, safeRound, calculateERI, calculateMSI, calculateMCI, calculateATR, calculateVWAP, calculatePearsonCorrelation, calculateCRF, calculateCVD, calculateHVNMigration, calculateHVR, analyze_volume_profile } from './taUtils';

const ADAPTIVE_WEIGHTING_MATRIX: Record<string, Record<string, number>> = {
    "Trending": {"ema_trend": 0.25, "ichimoku_trend": 0.25, "volume_profile_pos": 0.20, "rsi": 0.15, "vdr": 0.10, "correlation_strength": 0.05},
    "Ranging": {"ema_trend": 0.05, "ichimoku_trend": 0.05, "volume_profile_pos": 0.15, "rsi": 0.40, "vdr": 0.30, "correlation_strength": 0.05},
    "Weak Trend / Chop": {"ema_trend": 0.15, "ichimoku_trend": 0.15, "volume_profile_pos": 0.20, "rsi": 0.25, "vdr": 0.20, "correlation_strength": 0.05}
};

// Simplified mapping for CRF regimes
const CRF_TO_REGIME_MAP: Record<string, string> = {
    "Squeeze": "Ranging",
    "Trend": "Trending",
    "Range": "Ranging",
    "Chop": "Weak Trend / Chop",
};


async function makeRequest(endpoint: string, params: Record<string, any>) {
    const url = new URL(BYBIT_BASE_URL + endpoint);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.retCode !== 0) {
        throw new Error(`Bybit API Error: ${data.retMsg}`);
    }
    return data.result;
}

export const fetchFearAndGreedIndex = async (): Promise<FearAndGreedIndex | null> => {
    try {
        // Using a CORS proxy to bypass browser restrictions on the alternative.me API
        const response = await fetch('https://api.alternative.me/fng/?limit=1');
        if (!response.ok) {
            console.error("Failed to fetch Fear & Greed Index:", response.statusText);
            return null;
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
            const latest = data.data[0];
            return {
                value: parseInt(latest.value, 10),
                value_classification: latest.value_classification,
                timestamp: latest.timestamp,
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching Fear & Greed Index:", error);
        return null;
    }
};

export const fetchSymbols = async (category: string): Promise<BybitSymbol[]> => {
    let allSymbols: any[] = [];
    let cursor = '';
    const limit = 1000; // Max limit per page

    while (true) {
        const params: any = { category, limit };
        if (cursor) {
            params.cursor = cursor;
        }
        const result = await makeRequest('/v5/market/instruments-info', params);
        if (result && result.list) {
            allSymbols = allSymbols.concat(result.list);
        }

        if (result && result.nextPageCursor) {
            cursor = result.nextPageCursor;
        } else {
            break; // No more pages
        }
    }
    
    return allSymbols
        .filter((s: any) => s.quoteCoin === 'USDT' && s.status === 'Trading')
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
};

const _map_interval = (interval_str: string) => {
    const mapping: Record<string, string> = { "1": "1min", "3": "3min", "5": "5min", "15": "15min", "30": "30min", "60": "1h", "120": "2h", "240": "4h", "D": "1d", "W": "1w", "M": "1M" };
    return mapping[interval_str] || interval_str;
};

const analyzeDerivatives = async (symbol: string, category: string, interval: string, liveLiquidations: LiveLiquidation[]): Promise<DerivativesReport> => {
    const interval_api = _map_interval(interval);
    const allowed_intervals = ["5min", "15min", "30min", "1h", "4h", "1d"];
    const queryInterval = allowed_intervals.includes(interval_api) ? interval_api : "5min";

    const [oiResult, fundingResult, lsResult, oiDeltaResult] = await Promise.allSettled([
        makeRequest("/v5/market/open-interest", { category, symbol, intervalTime: queryInterval, limit: 1 }),
        makeRequest("/v5/market/funding/history", { category, symbol, limit: 1 }),
        makeRequest("/v5/market/account-ratio", { category, symbol, period: queryInterval, limit: 1 }),
        makeRequest("/v5/market/open-interest", { category, symbol, intervalTime: '5min', limit: 49 }),
    ]);

    const report: Partial<DerivativesReport> = {};
    if (oiResult.status === 'fulfilled' && oiResult.value.list[0]) {
        report.open_interest_value = parseFloat(oiResult.value.list[0].openInterest);
    }
    if (fundingResult.status === 'fulfilled' && fundingResult.value.list[0]) {
        report.funding_rate = parseFloat(fundingResult.value.list[0].fundingRate);
    }
    if (lsResult.status === 'fulfilled' && lsResult.value.list[0]) {
        report.long_short_ratio = parseFloat(lsResult.value.list[0].buyRatio);
    }
    if (oiDeltaResult.status === 'fulfilled' && oiDeltaResult.value.list.length > 1) {
        const sortedList = oiDeltaResult.value.list.sort((a: any, b: any) => parseInt(a.timestamp) - parseInt(b.timestamp));
        const latest_oi = parseFloat(sortedList[sortedList.length - 1].openInterest);
        const previous_oi = parseFloat(sortedList[0].openInterest);
        if (previous_oi > 0) {
            report.open_interest_delta_4h_pct = safeRound(((latest_oi - previous_oi) / previous_oi) * 100, 2);
        }
    }
     if (liveLiquidations.length > 0) {
        const longsLiquidated = liveLiquidations.filter(l => l.side === 'Sell');
        const shortsLiquidated = liveLiquidations.filter(l => l.side === 'Buy');

        const longs_usd = longsLiquidated.reduce((sum, l) => sum + (parseFloat(l.size) * parseFloat(l.price)), 0);
        const shorts_usd = shortsLiquidated.reduce((sum, l) => sum + (parseFloat(l.size) * parseFloat(l.price)), 0);
        const total_liquidated_usd = longs_usd + shorts_usd;
        
        const all_liqs_usd = liveLiquidations.map(l => parseFloat(l.size) * parseFloat(l.price));
        const largest_liq_usd = all_liqs_usd.length > 0 ? Math.max(...all_liqs_usd) : 0;

        report.recent_liquidations_report = {
            status: "Live data since last report",
            dominant_side: longs_usd > shorts_usd ? "Longs Liquidated" : "Shorts Liquidated",
            total_liquidated_usd: safeRound(total_liquidated_usd, 2),
            longs_usd: safeRound(longs_usd, 2),
            shorts_usd: safeRound(shorts_usd, 2),
            longs_count: longsLiquidated.length, 
            shorts_count: shortsLiquidated.length, 
            largest_liq_usd: safeRound(largest_liq_usd, 2)
        };
    } else {
        report.recent_liquidations_report = { status: "No liquidations detected since last report" };
    }

    return report as DerivativesReport;
};

const analyze_trade_flow = async (symbol: string, category: string) => {
    const result = await makeRequest("/v5/market/recent-trade", { category, symbol, limit: 1000 });
    const trades: BybitTrade[] = result.list;
    const taker_buy_vol = trades.filter((t: any) => t.side === 'Buy').reduce((sum: number, t: any) => sum + parseFloat(t.size), 0);
    const taker_sell_vol = trades.filter((t: any) => t.side === 'Sell').reduce((sum: number, t: any) => sum + parseFloat(t.size), 0);
    const total_vol = taker_buy_vol + taker_sell_vol;
    if (total_vol === 0) return { error: "No trade volume.", trades: [] };
    const buy_ratio = taker_buy_vol / total_vol;
    return {
        taker_buy_percentage: safeRound(buy_ratio * 100, 2),
        interpretation: buy_ratio > 0.55 ? "Aggressive Buyers Dominate" : buy_ratio < 0.45 ? "Aggressive Sellers Dominate" : "Neutral Aggression",
        trades
    };
};

const analyze_orderbook_deep = async (symbol: string, category: string): Promise<OrderbookData> => {
    try {
        const orderbook = await makeRequest("/v5/market/orderbook", { category, symbol, limit: 50 });
        
        if (!orderbook.b || !orderbook.a) {
             throw new Error("Invalid orderbook data received.");
        }
        
        const bids = orderbook.b.map((p: string[]) => [p[0], p[1]]) as [string, string][];
        const asks = orderbook.a.map((p: string[]) => [p[0], p[1]]) as [string, string][];

        if (bids.length === 0 || asks.length === 0) {
            throw new Error("Empty bids or asks in orderbook.");
        }

        const bestBid = parseFloat(bids[0][0]);
        const bestAsk = parseFloat(asks[0][0]);
        
        const bidVolume = bids.slice(0, 20).reduce((sum: number, level: string[]) => sum + parseFloat(level[1]), 0);
        const askVolume = asks.slice(0, 20).reduce((sum: number, level: string[]) => sum + parseFloat(level[1]), 0);
        
        return {
            spread_pct: bestBid > 0 ? safeRound(((bestAsk - bestBid) / bestBid) * 100, 4) : null,
            liquidity_imbalance_20_levels: safeRound((bidVolume - askVolume) / (bidVolume + askVolume || 1), 3)!,
            bid_volume_20_levels: safeRound(bidVolume, 2)!,
            ask_volume_20_levels: safeRound(askVolume, 2)!,
            depth_quality: Math.min(bids.length, asks.length) >= 20 ? "Good" : "Limited",
            bids,
            asks
        };
    } catch (error: any) {
        console.error(`Failed to fetch orderbook for ${symbol}:`, error);
        return { 
            error: "Failed to fetch or process orderbook data.",
            spread_pct: null,
            liquidity_imbalance_20_levels: 0,
            bid_volume_20_levels: 0,
            ask_volume_20_levels: 0,
            depth_quality: "Unknown",
            bids: [],
            asks: []
        };
    }
};

function analyze_btc_correlation(df_symbol: ProcessedKline[], df_btc: ProcessedKline[], window = 20): CorrelationReport {
    if (df_btc.length < window || df_symbol.length < window) return { error: "Insufficient data for BTC correlation." };

    const recent_symbol_closes = df_symbol.slice(-window).map(d => d.close);
    const recent_btc_closes = df_btc.slice(-window).map(d => d.close);

    // Calculate returns for correlation
    const symbol_returns = [];
    const btc_returns = [];
    for (let i = 1; i < recent_symbol_closes.length; i++) {
        symbol_returns.push((recent_symbol_closes[i] - recent_symbol_closes[i-1]) / recent_symbol_closes[i-1]);
        btc_returns.push((recent_btc_closes[i] - recent_btc_closes[i-1]) / recent_btc_closes[i-1]);
    }
    
    const correlation = calculatePearsonCorrelation(symbol_returns, btc_returns);
    
    // Calculate relative performance
    const symbol_perf_pct = ((recent_symbol_closes[recent_symbol_closes.length - 1] / recent_symbol_closes[0]) - 1) * 100;
    const btc_perf_pct = ((recent_btc_closes[recent_btc_closes.length - 1] / recent_btc_closes[0]) - 1) * 100;
    const relative_perf_pct_diff = symbol_perf_pct - btc_perf_pct;
    
    let relative_performance = "Neutral";
    if (relative_perf_pct_diff > 2) relative_performance = `Outperforming BTC`;
    else if (relative_perf_pct_diff < -2) relative_performance = `Underperforming BTC`;

    let correlation_interpretation = "N/A";
    if(correlation !== null) {
        if (correlation > 0.7) correlation_interpretation = "Strongly Positive";
        else if (correlation > 0.3) correlation_interpretation = "Moderately Positive";
        else if (correlation < -0.7) correlation_interpretation = "Strongly Negative";
        else if (correlation < -0.3) correlation_interpretation = "Moderately Negative";
        else correlation_interpretation = "Weak / No Correlation";
    }

    return {
        correlation_coefficient_20p: safeRound(correlation, 3),
        correlation_interpretation,
        relative_performance,
        relative_performance_pct_diff: safeRound(relative_perf_pct_diff, 2)
    };
}

const process_kline_data = (kline_list: Kline[]): ProcessedKline[] => {
    return kline_list.map(k => ({
        timestamp: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
    })).reverse();
};

export const calculateStandardIndicators = (df: ProcessedKline[]) => {
    const closes = df.map(d => d.close);
    const highs = df.map(d => d.high);
    const lows = df.map(d => d.low);
    const volumes = df.map(d => d.volume);

    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const rsi14 = calculateRSI(closes, 14);
    const bb20 = calculateBB(closes, 20, 2);
    const adx14 = calculateADX(highs, lows, closes, 14);
    const obv = calculateOBV(closes, volumes);
    const ichimoku = calculateIchimoku(highs, lows, { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 });
    const kc20 = calculateKC(highs, lows, closes, 20, 2);
    const vdr = calculate_vwap_deviation_ratio(df, 14);
    const fer = calculate_fractal_efficiency_ratio(df, 14);
    const mfi_v = calculate_mfi_v(df, rsi14, adx14);
    const vpe = calculate_vpe(df, bb20.bandwidth, adx14);
    const atr20 = calculateATR(highs, lows, closes, 20);

    const latest = {
        close: df.length > 0 ? df[df.length - 1].close : 0,
        EMA_50: ema50[ema50.length - 1],
        EMA_200: ema200[ema200.length - 1],
        RSI_14: rsi14[rsi14.length - 1],
        ADX_14: adx14.length > 0 ? adx14[adx14.length - 1]?.adx : null,
        BBB_20_2: bb20.bandwidth[bb20.bandwidth.length - 1],
        BBU_20_2: bb20.upper[bb20.upper.length-1],
        BBL_20_2: bb20.lower[bb20.lower.length-1],
        FER: fer[fer.length - 1],
        Ichimoku_ISA: ichimoku.senkouA.length > 0 ? ichimoku.senkouA[ichimoku.senkouA.length - 1] : null,
        Ichimoku_ISB: ichimoku.senkouB.length > 0 ? ichimoku.senkouB[ichimoku.senkouB.length - 1] : null,
        Ichimoku_Tenkan: ichimoku.tenkan.length > 0 ? ichimoku.tenkan[ichimoku.tenkan.length-1] : null,
        Ichimoku_Kijun: ichimoku.kijun.length > 0 ? ichimoku.kijun[ichimoku.kijun.length-1] : null,
        KCLe_20_2: kc20.lower[kc20.lower.length - 1],
        KCUe_20_2: kc20.upper[kc20.upper.length - 1],
    };

    return {
        ema20, ema50, ema200, rsi14, bb20, adx14, obv, ichimoku, kc20, vdr, fer, mfi_v, vpe, atr20, latest
    };
};

// FIX: Exported 'calculate_quantitative_score' to make it accessible to the backtester service.
// REFACTORED: Removed dependencies on MSI and MCI for backtesting integrity.
export const calculate_quantitative_score = (indicators: any, crfRegime: string) => {
    
    // Determine the base regime for weighting
    let baseRegime = "Weak Trend / Chop"; // Default
    for (const key in CRF_TO_REGIME_MAP) {
        if (crfRegime.includes(key)) {
            baseRegime = CRF_TO_REGIME_MAP[key];
            break;
        }
    }
    const weights = ADAPTIVE_WEIGHTING_MATRIX[baseRegime];
    
    const normalized_structural_values = {
        "ema_trend": indicators.trend_ema === "Bullish" ? 1 : -1,
        "ichimoku_trend": indicators.ichimoku_trend_signal,
        "volume_profile_pos": /Above/.test(indicators.vp_pos) ? 1 : /Below/.test(indicators.vp_pos) ? -1 : 0,
        "rsi": indicators.RSI_14 != null ? (indicators.RSI_14 - 50) / 50 : 0,
        "vdr": indicators.VDR ? Math.max(-1, Math.min(1, indicators.VDR / 2.5)) : 0, // VDR capped at +/- 2.5%
        "correlation_strength": /Outperforming/.test(indicators.relative_perf) ? 0.5 : /Underperforming/.test(indicators.relative_perf) ? -0.5 : 0,
    };

    let structuralScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
        structuralScore += (normalized_structural_values[key as keyof typeof normalized_structural_values] || 0) * weight;
    }
    structuralScore = Math.max(-1, Math.min(1, structuralScore)); // Clamp to [-1, 1]
    
    const structural_interpretation = structuralScore > 0.5 ? "Strong Bullish Structure" : structuralScore > 0.1 ? "Bullish Structure" : structuralScore < -0.5 ? "Strong Bearish Structure" : structuralScore < -0.1 ? "Bearish Structure" : "Neutral Structure";
    
    const final_signal = structuralScore > 0.5 ? "Strong Bullish" : structuralScore > 0.1 ? "Bullish" : structuralScore < -0.5 ? "Strong Bearish" : structuralScore < -0.1 ? "Bearish" : "Neutral";
    const interpretation = `${final_signal} Signal. Bias: ${structural_interpretation}.`;

    return {
        structural_score: safeRound(structuralScore, 3),
        structural_interpretation,
        flow_modifier: 0, // No flow in backtest
        flow_interpretation: "N/A (Backtest)",
        composite_score: safeRound(structuralScore, 3), // Composite is now purely structural
        interpretation,
        // FIX: The `active_weighting_matrix` property expects a `Record<string, Record<string, number>>`
        // but was being passed `weights` which is `Record<string, number>`.
        // Returning the full `ADAPTIVE_WEIGHTING_MATRIX` satisfies the type contract.
        active_weighting_matrix: ADAPTIVE_WEIGHTING_MATRIX,
        dominant_state_from_msi: crfRegime
    };
};

async function generateSingleReport(category: string, symbol: string, interval: string, liveLiquidations: LiveLiquidation[], fearAndGreedIndex: FearAndGreedIndex | null, prevDayKlineResult: any): Promise<FullReport> {
    
    const [klineResult, tickersResult, recentTradesResult, btcKlineResult, orderbook_analysis] = await Promise.all([
        makeRequest("/v5/market/kline", { category, symbol, interval, limit: 1000 }),
        makeRequest("/v5/market/tickers", { category, symbol }),
        analyze_trade_flow(symbol, category),
        symbol !== "BTCUSDT" ? makeRequest("/v5/market/kline", { category, symbol: "BTCUSDT", interval, limit: 1000 }) : Promise.resolve(null),
        analyze_orderbook_deep(symbol, category),
    ]);

    const df: ProcessedKline[] = process_kline_data(klineResult.list);
    const tickers_data = tickersResult.list[0];
    const recent_trades: BybitTrade[] = recentTradesResult.trades;
    const df_btc: ProcessedKline[] = btcKlineResult ? process_kline_data(btcKlineResult.list) : [];

    const { ema20, ema50, ema200, rsi14, bb20, adx14, obv, ichimoku, kc20, vdr, fer, mfi_v, vpe, atr20, latest } = calculateStandardIndicators(df);

    // Required for price_action_levels
    const highs = df.map(d => d.high);
    const lows = df.map(d => d.low);
    
    const derivatives_report = await analyzeDerivatives(symbol, category, interval, liveLiquidations);

    const eri_report = calculateERI(recent_trades);
    const msi_report = calculateMSI(latest.ADX_14 ?? 15, latest.BBB_20_2 ?? 0, latest.FER ?? 0.5, bb20.bandwidth, fer);
    const mci_report = calculateMCI(df, ema20, recentTradesResult.taker_buy_percentage ?? 50, derivatives_report.funding_rate ?? 0, derivatives_report.long_short_ratio ?? 0.5, derivatives_report.open_interest_delta_4h_pct, eri_report, interval);

    const crf_report = calculateCRF(latest.ADX_14, latest.BBB_20_2, latest.FER, latest.EMA_50, latest.EMA_200, bb20.bandwidth);

    const volume_profile_report = analyze_volume_profile(df);
    const correlation_report = symbol === 'BTCUSDT' ? { correlation_interpretation: "N/A (Base Asset)" } : analyze_btc_correlation(df, df_btc);
    const trend_ema = latest.EMA_50 != null && latest.EMA_200 != null ? (latest.EMA_50 > latest.EMA_200 ? "Bullish" : "Bearish") : "N/A";
    
    const ichimoku_analysis = (latest.Ichimoku_ISA === null || latest.Ichimoku_ISB === null || latest.Ichimoku_Tenkan === null || latest.Ichimoku_Kijun === null)
    ? { "error": "Insufficient data for Ichimoku." }
    : {
        trend: latest.close > Math.max(latest.Ichimoku_ISA, latest.Ichimoku_ISB) ? "Bullish (Price above Kumo)" : "Bearish (Price below Kumo)",
        momentum: latest.Ichimoku_Tenkan > latest.Ichimoku_Kijun ? 'Bullish (Tenkan > Kijun)' : 'Bearish (Tenkan < Kijun)',
        future_outlook: latest.Ichimoku_ISA > latest.Ichimoku_ISB ? 'Bullish (Senkou A > Senkou B)' : 'Bearish (Senkou A < Senkou B)',
        tenkan_sen: safeRound(latest.Ichimoku_Tenkan, 5),
        kijun_sen: safeRound(latest.Ichimoku_Kijun, 5),
        senkou_a: safeRound(latest.Ichimoku_ISA, 5),
        senkou_b: safeRound(latest.Ichimoku_ISB, 5),
    };

    const indicators_for_scoring = {
        trend_ema,
        ichimoku_trend_signal: ichimoku_analysis.error ? 0 : /Bullish/.test(ichimoku_analysis.trend!) ? 1 : -1,
        vp_pos: volume_profile_report.price_position_vs_va,
        RSI_14: latest.RSI_14,
        VDR: vdr.length > 0 ? vdr[vdr.length - 1] : null,
        relative_perf: 'relative_performance' in correlation_report ? correlation_report.relative_performance : undefined,
    };

    const score_result = calculate_quantitative_score(indicators_for_scoring, crf_report);

    // --- KEY LEVELS ANALYSIS ---
    const price_action_levels = {
        type: "Price Action",
        basis: "Highest high and lowest low over last 20 periods",
        support: highs.length >= 20 ? Math.min(...lows.slice(-20)) : null,
        resistance: lows.length >= 20 ? Math.max(...highs.slice(-20)) : null,
    };

    const volume_profile_levels = {
        type: "Volume-Based",
        basis: "Volume distribution over last 1000 periods",
        poc_point_of_control: volume_profile_report.point_of_control_poc ?? null,
        vah_value_area_high: volume_profile_report.value_area_high_vah ?? null,
        val_value_area_low: volume_profile_report.value_area_low_val ?? null,
    };
    
    let fibonacci_pivot_levels: KeyLevels['fibonacci_pivot_levels'];
    const prevDayKlines = prevDayKlineResult.list;
    if (prevDayKlines && prevDayKlines.length > 1) {
        const prevDay = prevDayKlines[1]; // [0] is today (partial), [1] is yesterday
        const h = parseFloat(prevDay[2]);
        const l = parseFloat(prevDay[3]);
        const c = parseFloat(prevDay[4]);
        const range = h - l;
        const pp = (h + l + c) / 3;

        fibonacci_pivot_levels = {
            type: "Static (Predictive)",
            basis: "Previous Day's H/L/C with Fibonacci multiples",
            pp_pivot_point: safeRound(pp, 5),
            resistances: {
                r1: safeRound(pp + (range * 0.382), 5),
                r2: safeRound(pp + (range * 0.618), 5),
                r3: safeRound(pp + (range * 1.0), 5),
            },
            supports: {
                s1: safeRound(pp - (range * 0.382), 5),
                s2: safeRound(pp - (range * 0.618), 5),
                s3: safeRound(pp - (range * 1.0), 5),
            },
        };
    } else {
        fibonacci_pivot_levels = { error: "Insufficient daily data for Pivots." };
    }
    
    const vwap20 = calculateVWAP(df, 20);
    const latest_atr = atr20[atr20.length - 1];
    const latest_vwap = vwap20[vwap20.length - 1];

    const volatility_projection_levels = {
        type: "Dynamic (Predictive)",
        basis: "VWAP (anchor) +/- multiples of ATR (volatility) over 20 periods",
        anchor_vwap: safeRound(latest_vwap, 5),
        resistances: {
            r1: safeRound(latest_vwap && latest_atr ? latest_vwap + 1 * latest_atr : null, 5),
            r2: safeRound(latest_vwap && latest_atr ? latest_vwap + 2 * latest_atr : null, 5),
            r3: safeRound(latest_vwap && latest_atr ? latest_vwap + 3 * latest_atr : null, 5),
        },
        supports: {
            s1: safeRound(latest_vwap && latest_atr ? Math.max(0, latest_vwap - 1 * latest_atr) : null, 5),
            s2: safeRound(latest_vwap && latest_atr ? Math.max(0, latest_vwap - 2 * latest_atr) : null, 5),
            s3: safeRound(latest_vwap && latest_atr ? Math.max(0, latest_vwap - 3 * latest_atr) : null, 5),
        },
    };

    const trend_following_levels = {
        type: "Dynamic (Trend-Following)",
        basis: "Moving averages and volatility bands",
        ema50: safeRound(latest.EMA_50, 5),
        ema200: safeRound(latest.EMA_200, 5),
        bollinger_upper: safeRound(latest.BBU_20_2, 5),
        bollinger_lower: safeRound(latest.BBL_20_2, 5),
    };
    
    const key_levels: KeyLevels = {
        price_action_levels,
        volume_profile_levels,
        fibonacci_pivot_levels,
        volatility_projection_levels,
        trend_following_levels,
    };

    // --- APEX EXCLUSIVE INDICATORS CALCULATION ---
    const poc_first_half = analyze_volume_profile(df.slice(0, 500)).point_of_control_poc ?? null;
    const poc_second_half = analyze_volume_profile(df.slice(500, 1000)).point_of_control_poc ?? null;

    const apex_exclusive_indicators: ApexExclusiveIndicators = {
        cumulative_volume_delta: calculateCVD(df),
        hvn_migration: calculateHVNMigration(poc_first_half, poc_second_half),
        historical_volatility_rank: calculateHVR(atr20)
    };


    const intervalLabelMap: Record<string, string> = { '5': '5m', '15': '15m', '30': '30m', '60': '1h', '240': '4h', 'D': '1D', 'W': '1W' };
    const period_change_pct = df.length >= 2 ? safeRound(((df[df.length - 1].close - df[df.length - 2].close) / df[df.length - 2].close) * 100, 2) : null;
    
    // --- Refined Squeeze Detection Logic ---
    // Condition 1: Classic TTM Squeeze (BB inside KC)
    const isClassicSqueeze = (
        latest.BBL_20_2 !== null && latest.KCLe_20_2 !== null &&
        latest.BBU_20_2 !== null && latest.KCUe_20_2 !== null &&
        latest.BBL_20_2 > latest.KCLe_20_2 &&
        latest.BBU_20_2 < latest.KCUe_20_2
    );

    // Condition 2: Check if BBW is historically low (e.g., in the bottom 20th percentile)
    const recentBbwHistory = bb20.bandwidth.filter(v => v !== null).slice(-100) as number[];
    let isLowVolatility = false;
    if (recentBbwHistory.length > 20 && latest.BBB_20_2 !== null) {
        const sortedBbw = [...recentBbwHistory].sort((a, b) => a - b);
        const lowVolatilityThreshold = sortedBbw[Math.floor(sortedBbw.length * 0.20)]; // 20th percentile
        isLowVolatility = latest.BBB_20_2 <= lowVolatilityThreshold;
    }

    // Condition 3: Check if market is not in a strong trend
    const isNotTrending = latest.ADX_14 === null || latest.ADX_14 < 25;

    // A high-conviction squeeze requires all three conditions to be met
    const refinedSqueezeStatus = (isClassicSqueeze && isLowVolatility && isNotTrending)
        ? "SQUEEZE_DETECTED"
        : "No Squeeze";


    return {
        asset_info: { symbol, timeframe: interval, category, timestamp_utc: new Date(df.length > 0 ? df[df.length - 1].timestamp : Date.now()).toUTCString() },
        kline_data: df,
        apex_exclusive_indicators,
        market_snapshot: {
            close_price: latest.close,
            price_24h_change_pct: safeRound(parseFloat(tickers_data.price24hPcnt) * 100, 2),
            volume_24h: parseFloat(tickers_data.volume24h),
            period_change_pct: period_change_pct,
            period_volume: df.length >= 1 ? df[df.length - 1].volume : null,
            interval_label: intervalLabelMap[interval] || interval
        },
        derivatives_analysis: derivatives_report,
        microstructure_analysis: { orderbook_liquidity: orderbook_analysis, taker_volume_analysis_1000_trades: recentTradesResult },
        correlation_analysis: correlation_report,
        volume_profile_analysis: volume_profile_report,
        standard_indicators: {
            EMA_50: safeRound(latest.EMA_50, 5), EMA_200: safeRound(latest.EMA_200, 5),
            RSI_14: safeRound(latest.RSI_14, 2), ADX_14: safeRound(latest.ADX_14, 2)
        },
        advanced_analysis: {
            trend_ema, market_regime_adx: getMarketRegime(latest.ADX_14),
            divergences: { rsi_divergence: detect_divergence(df, rsi14, 'RSI_14'), obv_divergence: detect_divergence(df, obv, 'OBV') }
        },
        ichimoku_analysis,
        volatility_analysis: { 
            bollinger_band_width_pct: safeRound(latest.BBB_20_2, 4), 
            keltner_channels_squeeze: refinedSqueezeStatus
        },
        chimera_analysis: {
            regime_filter_crf: crf_report,
            momentum_flow_index_mfi_v: safeRound(mfi_v.length > 0 ? mfi_v[mfi_v.length - 1] : null, 2),
            volatility_potential_energy_vpe: safeRound(vpe.length > 0 ? vpe[vpe.length-1]: null, 2),
            vwap_deviation_ratio_vdr: safeRound(vdr.length > 0 ? vdr[vdr.length-1]: null, 2),
            fractal_efficiency_ratio_fer: safeRound(latest.FER, 2)
        },
        extra_indicators: {
            ATR_20: safeRound(latest_atr, 5),
            PDI_14: safeRound(adx14.length > 0 ? adx14[adx14.length - 1]?.pdi : null, 2),
            MDI_14: safeRound(adx14.length > 0 ? adx14[adx14.length - 1]?.mdi : null, 2),
        },
        key_levels,
        unification_analysis: {
            market_state_index_msi: msi_report,
            multi_layer_conviction_index_mci: mci_report,
            effort_vs_result_index_eri: eri_report,
        },
        sentiment_analysis: {
            fear_and_greed_index: fearAndGreedIndex
        },
        quantitative_score_analysis: {
            ...score_result
        }
    };
};

export const generateFullReport = async (category: string, symbol: string, interval: string) => {
    const [fearAndGreedResult, prevDayKlineResult] = await Promise.all([
        fetchFearAndGreedIndex(),
        makeRequest("/v5/market/kline", { category, symbol, interval: 'D', limit: 2 }),
    ]);

    const allTimeframes = INTERVALS.map(i => i.value);
    const reportPromises = allTimeframes.map(tf => 
        generateSingleReport(category, symbol, tf, [], fearAndGreedResult, prevDayKlineResult)
    );
    const allReports = await Promise.all(reportPromises);

    const report = allReports.find(r => r.asset_info.timeframe === interval)!;
    const htfReports = allReports.filter(r => ['240', 'D'].includes(r.asset_info.timeframe));

    return { report, htfReports, allReports, prevDayKlineResult, fearAndGreedResult };
}

export const recalculateReportWithLiveData = async (
    baseReport: FullReport,
    liveKlineData: ProcessedKline[],
    liveBtcKlineData: ProcessedKline[],
    prevDayKline: any,
    liveTickerData: LiveTickerData | null,
    liveLiquidations: LiveLiquidation[],
    liveTrades: BybitTrade[],
    bids: string[][],
    asks: string[][],
    fearAndGreedIndex: FearAndGreedIndex | null
): Promise<FullReport> => {
    const { symbol, category, timeframe: interval } = baseReport.asset_info;

    // Use live data where available, fallback to data from base report
    const df: ProcessedKline[] = liveKlineData;
    const tickers_data = liveTickerData || { 
        lastPrice: baseReport.market_snapshot.close_price.toString(),
        price24hPcnt: ((baseReport.market_snapshot.price_24h_change_pct ?? 0) / 100).toString(),
        volume24h: baseReport.market_snapshot.volume_24h.toString(),
    };
    const df_btc: ProcessedKline[] = liveBtcKlineData;
    
    // --- This section is a mirror of generateSingleReport, using live data ---
    
    const { ema20, ema50, ema200, rsi14, bb20, adx14, obv, ichimoku, kc20, vdr, fer, mfi_v, vpe, atr20, latest } = calculateStandardIndicators(df);

    const derivatives_report = { ...baseReport.derivatives_analysis }; // Use base, update with live
    if (liveTickerData) {
        if (liveTickerData.openInterest) derivatives_report.open_interest_value = parseFloat(liveTickerData.openInterest);
        if (liveTickerData.fundingRate) derivatives_report.funding_rate = parseFloat(liveTickerData.fundingRate);
    }
    
    const taker_buy_vol = liveTrades.filter((t: any) => t.side === 'Buy').reduce((sum: number, t: any) => sum + parseFloat(t.size), 0);
    const taker_sell_vol = liveTrades.filter((t: any) => t.side === 'Sell').reduce((sum: number, t: any) => sum + parseFloat(t.size), 0);
    const microstructure_report = {
        taker_buy_percentage: safeRound((taker_buy_vol / (taker_buy_vol + taker_sell_vol || 1)) * 100, 2),
        interpretation: "Recalculated",
        trades: liveTrades,
    };
    
    const orderbook_analysis: OrderbookData = {
        ...baseReport.microstructure_analysis.orderbook_liquidity,
        bids: bids.map(([price, size]) => [price, size]),
        asks: asks.map(([price, size]) => [price, size]),
    };
    
    const eri_report = calculateERI(liveTrades);
    const msi_report = calculateMSI(latest.ADX_14 ?? 15, latest.BBB_20_2 ?? 0, latest.FER ?? 0.5, bb20.bandwidth, fer);
    const mci_report = calculateMCI(df, ema20, microstructure_report.taker_buy_percentage ?? 50, derivatives_report.funding_rate ?? 0, derivatives_report.long_short_ratio ?? 0.5, derivatives_report.open_interest_delta_4h_pct, eri_report, interval);
    const crf_report = calculateCRF(latest.ADX_14, latest.BBB_20_2, latest.FER, latest.EMA_50, latest.EMA_200, bb20.bandwidth);
    const volume_profile_report = analyze_volume_profile(df);
    const correlation_report = symbol === 'BTCUSDT' ? { correlation_interpretation: "N/A (Base Asset)" } : analyze_btc_correlation(df, df_btc);
    const trend_ema = latest.EMA_50 != null && latest.EMA_200 != null ? (latest.EMA_50 > latest.EMA_200 ? "Bullish" : "Bearish") : "N/A";
    // FIX: Added more robust null-checking for Ichimoku values to prevent runtime errors with non-null assertions.
    const ichimoku_analysis = (latest.Ichimoku_ISA === null || latest.Ichimoku_ISB === null || latest.Ichimoku_Tenkan === null || latest.Ichimoku_Kijun === null) ? { "error": "Insufficient data for Ichimoku." } : {
        trend: latest.close > Math.max(latest.Ichimoku_ISA, latest.Ichimoku_ISB) ? "Bullish (Price above Kumo)" : "Bearish (Price below Kumo)",
        momentum: latest.Ichimoku_Tenkan > latest.Ichimoku_Kijun ? 'Bullish (Tenkan > Kijun)' : 'Bearish (Tenkan < Kijun)',
        future_outlook: latest.Ichimoku_ISA > latest.Ichimoku_ISB ? 'Bullish (Senkou A > Senkou B)' : 'Bearish (Senkou A < Senkou B)',
        tenkan_sen: safeRound(latest.Ichimoku_Tenkan, 5), kijun_sen: safeRound(latest.Ichimoku_Kijun, 5),
        senkou_a: safeRound(latest.Ichimoku_ISA, 5), senkou_b: safeRound(latest.Ichimoku_ISB, 5),
    };
    const indicators_for_scoring = {
        trend_ema,
        ichimoku_trend_signal: ichimoku_analysis.error ? 0 : /Bullish/.test(ichimoku_analysis.trend!) ? 1 : -1,
        vp_pos: volume_profile_report.price_position_vs_va,
        RSI_14: latest.RSI_14, VDR: vdr.length > 0 ? vdr[vdr.length - 1] : null,
        relative_perf: 'relative_performance' in correlation_report ? correlation_report.relative_performance : undefined,
    };
    const score_result = calculate_quantitative_score(indicators_for_scoring, crf_report);
    const key_levels = { ...baseReport.key_levels }; // Recalculating all levels is complex, update the most dynamic ones
    key_levels.trend_following_levels = {
        type: "Dynamic (Trend-Following)", basis: "Moving averages and volatility bands",
        ema50: safeRound(latest.EMA_50, 5), ema200: safeRound(latest.EMA_200, 5),
        bollinger_upper: safeRound(latest.BBU_20_2, 5), bollinger_lower: safeRound(latest.BBL_20_2, 5),
    };
    const poc_first_half = analyze_volume_profile(df.slice(0, 500)).point_of_control_poc ?? null;
    const poc_second_half = analyze_volume_profile(df.slice(500, 1000)).point_of_control_poc ?? null;
    const apex_exclusive_indicators: ApexExclusiveIndicators = {
        cumulative_volume_delta: calculateCVD(df), hvn_migration: calculateHVNMigration(poc_first_half, poc_second_half),
        historical_volatility_rank: calculateHVR(atr20)
    };
    const refinedSqueezeStatus = (latest.BBL_20_2 && latest.KCLe_20_2 && latest.BBU_20_2 && latest.KCUe_20_2 && latest.BBL_20_2 > latest.KCLe_20_2 && latest.BBU_20_2 < latest.KCUe_20_2) ? "SQUEEZE_DETECTED" : "No Squeeze";

    return {
        ...baseReport,
        asset_info: { ...baseReport.asset_info, timestamp_utc: new Date(df.length > 0 ? df[df.length - 1].timestamp : Date.now()).toUTCString() },
        kline_data: df,
        apex_exclusive_indicators,
        market_snapshot: {
            ...baseReport.market_snapshot,
            close_price: latest.close,
            price_24h_change_pct: safeRound(parseFloat(tickers_data.price24hPcnt) * 100, 2),
            volume_24h: parseFloat(tickers_data.volume24h),
            period_change_pct: df.length >= 2 ? safeRound(((df[df.length - 1].close - df[df.length - 2].close) / df[df.length - 2].close) * 100, 2) : null,
            period_volume: df.length >= 1 ? df[df.length - 1].volume : null,
        },
        derivatives_analysis: derivatives_report,
        microstructure_analysis: { orderbook_liquidity: orderbook_analysis, taker_volume_analysis_1000_trades: microstructure_report },
        correlation_analysis: correlation_report, volume_profile_analysis: volume_profile_report,
        standard_indicators: {
            EMA_50: safeRound(latest.EMA_50, 5), EMA_200: safeRound(latest.EMA_200, 5),
            RSI_14: safeRound(latest.RSI_14, 2), ADX_14: safeRound(latest.ADX_14, 2)
        },
        advanced_analysis: {
            trend_ema, market_regime_adx: getMarketRegime(latest.ADX_14),
            divergences: { rsi_divergence: detect_divergence(df, rsi14, 'RSI_14'), obv_divergence: detect_divergence(df, obv, 'OBV') }
        },
        ichimoku_analysis,
        volatility_analysis: { bollinger_band_width_pct: safeRound(latest.BBB_20_2, 4), keltner_channels_squeeze: refinedSqueezeStatus },
        chimera_analysis: {
            regime_filter_crf: crf_report,
            momentum_flow_index_mfi_v: safeRound(mfi_v.length > 0 ? mfi_v[mfi_v.length - 1] : null, 2),
            volatility_potential_energy_vpe: safeRound(vpe.length > 0 ? vpe[vpe.length - 1] : null, 2),
            vwap_deviation_ratio_vdr: safeRound(vdr.length > 0 ? vdr[vdr.length - 1] : null, 2),
            fractal_efficiency_ratio_fer: safeRound(latest.FER, 2)
        },
        extra_indicators: {
            ATR_20: safeRound(atr20[atr20.length - 1], 5),
            PDI_14: safeRound(adx14.length > 0 ? adx14[adx14.length - 1]?.pdi : null, 2),
            MDI_14: safeRound(adx14.length > 0 ? adx14[adx14.length - 1]?.mdi : null, 2),
        },
        key_levels,
        unification_analysis: { market_state_index_msi: msi_report, multi_layer_conviction_index_mci: mci_report, effort_vs_result_index_eri: eri_report, },
        sentiment_analysis: { fear_and_greed_index: fearAndGreedIndex },
        quantitative_score_analysis: { ...score_result }
    };
};