import type {
    StrategyConfig,
    FullReport,
    BacktestSettings,
    BacktestResults,
    TradeLogEntry,
    ContextualFilter,
    ProcessedKline,
    IndicatorName,
    EnrichedKline,
    ConfluenceZone,
    ConfluenceZoneExitTarget,
} from '../types';
import { 
    calculateATR, 
    calculateEMA, 
    calculateRSI, 
    calculateBB, 
    calculateADX, 
    calculate_vwap_deviation_ratio, 
    calculate_fractal_efficiency_ratio, 
    calculate_mfi_v, 
    calculate_vpe,
    calculateCRF,
    calculateHVR,
    calculateKC,
    analyze_volume_profile,
    calculateHVNMigration,
    calculateIchimoku,
    calculateVWAP,
} from './taUtils';
import { 
    calculate_quantitative_score
} from './analysisService';
import { findLevelConfluence } from './confluenceService';


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const calculateRelativePerformance = (df_symbol: ProcessedKline[], df_btc: ProcessedKline[], window = 20): string => {
    if (df_btc.length < window || df_symbol.length < window) return "N/A";
    
    const recent_symbol_closes = df_symbol.slice(-window).map(d => d.close);
    const recent_btc_closes = df_btc.slice(-window).map(d => d.close);

    const symbol_perf_pct = ((recent_symbol_closes[recent_symbol_closes.length - 1] / recent_symbol_closes[0]) - 1) * 100;
    const btc_perf_pct = ((recent_btc_closes[recent_btc_closes.length - 1] / recent_btc_closes[0]) - 1) * 100;
    const relative_perf_pct_diff = symbol_perf_pct - btc_perf_pct;
    
    if (relative_perf_pct_diff > 1) return `Outperforming BTC`;
    if (relative_perf_pct_diff < -1) return `Underperforming BTC`;
    return "Neutral";
}

const enrichKlineData = async (
    klines: ProcessedKline[], 
    btcKlines: ProcessedKline[],
    onProgress: (progress: number) => void
): Promise<EnrichedKline[]> => {

    const enrichedKlines: EnrichedKline[] = [];
    const hasBtcData = btcKlines.length === klines.length;

    for (let i = 0; i < klines.length; i++) {
        if (i < 200) {
            enrichedKlines.push({ ...klines[i], indicators: {} });
            continue;
        }

        // --- CORE FIX: Create historical slice for each candle ---
        const klineSlice = klines.slice(0, i + 1);
        const closes = klineSlice.map(k => k.close);
        const highs = klineSlice.map(k => k.high);
        const lows = klineSlice.map(k => k.low);

        // --- CORE FIX: Recalculate indicators on the slice and take ONLY THE LAST value ---
        const atr20 = calculateATR(highs, lows, closes, 20).pop() ?? null;
        const ema50 = calculateEMA(closes, 50).pop() ?? null;
        const ema200 = calculateEMA(closes, 200).pop() ?? null;
        const rsi14 = calculateRSI(closes, 14).pop() ?? null;
        const adx14 = calculateADX(highs, lows, closes, 14).pop() ?? { adx: null };
        const bb20 = {
            bandwidth: calculateBB(closes, 20, 2).bandwidth.pop() ?? null,
            lower: calculateBB(closes, 20, 2).lower.pop() ?? null,
            upper: calculateBB(closes, 20, 2).upper.pop() ?? null,
        };
        const kc20 = {
             lower: calculateKC(highs, lows, closes, 20, 2).lower.pop() ?? null,
             upper: calculateKC(highs, lows, closes, 20, 2).upper.pop() ?? null,
        };
        const fer14 = calculate_fractal_efficiency_ratio(klineSlice, 14).pop() ?? null;
        const vdr14 = calculate_vwap_deviation_ratio(klineSlice, 14).pop() ?? null;
        
        const fullRsiSeries = calculateRSI(closes, 14);
        const fullAdxSeries = calculateADX(highs, lows, closes, 14);
        const fullBbwSeries = calculateBB(closes, 20, 2).bandwidth;
        
        const vpe = calculate_vpe(klineSlice, fullBbwSeries, fullAdxSeries).pop() ?? null;
        const mfi_v = calculate_mfi_v(klineSlice, fullRsiSeries, fullAdxSeries).pop() ?? null;
        
        const indicators: any = {
            EMA50: ema50,
            EMA200: ema200,
            RSI14: rsi14,
            ADX14: adx14.adx,
            BBW_PCT: bb20.bandwidth,
            VPE: vpe,
            ATR20: atr20,
        };

        const hvnWindow = klineSlice.slice(-200);
        const firstHalf = hvnWindow.slice(0, 100);
        const secondHalf = hvnWindow.slice(100, 200);
        const pocFirstHalf = analyze_volume_profile(firstHalf).point_of_control_poc ?? null;
        const pocSecondHalf = analyze_volume_profile(secondHalf).point_of_control_poc ?? null;
        indicators.HVN_Migration_Status = calculateHVNMigration(pocFirstHalf, pocSecondHalf).status;
        
        indicators.Chimera_FER = fer14;
        indicators.Chimera_VDR = vdr14;
        indicators.Chimera_MFI_V = mfi_v;

        const atrHistorySlice = calculateATR(highs, lows, closes, 20);
        indicators.Volatility_HV_Rank = calculateHVR(atrHistorySlice)?.rank;

        if (hasBtcData) {
            const btcKlineSlice = btcKlines.slice(0, i + 1);
            indicators.BTC_Correlation_Relative_Perf = calculateRelativePerformance(klineSlice, btcKlineSlice);
        } else {
            indicators.BTC_Correlation_Relative_Perf = 'N/A';
        }
        
        const isClassicSqueeze = bb20.lower && kc20.lower && bb20.upper && kc20.upper && bb20.lower > kc20.lower && bb20.upper < kc20.upper;
        indicators.Volatility_Squeeze_Status = isClassicSqueeze ? "SQUEEZE_DETECTED" : "No Squeeze";

        indicators.CRF_Regime = calculateCRF(
            indicators.ADX14,
            indicators.BBW_PCT,
            indicators.Chimera_FER,
            indicators.EMA50,
            indicators.EMA200,
            fullBbwSeries
        );
        
        const quantIndicators = {
            trend_ema: indicators.EMA50 > indicators.EMA200 ? 'Bullish' : 'Bearish',
            ichimoku_trend_signal: 0, 
            vp_pos: "Inside Value Area (Neutral)",
            RSI_14: indicators.RSI14,
            VDR: indicators.Chimera_VDR,
            relative_perf: indicators.BTC_Correlation_Relative_Perf
        };
        
        const quantScore = calculate_quantitative_score(quantIndicators, indicators.CRF_Regime);
        indicators.Quantitative_Score_Composite = quantScore.composite_score;
        indicators.Quantitative_Score_Structural = quantScore.structural_score;

        enrichedKlines.push({ ...klines[i], indicators });
        
        if (i % 20 === 0) {
            const enrichmentProgress = (i / klines.length) * 20; // Phase takes 20% (10->30)
            onProgress(10 + enrichmentProgress);
            await sleep(0);
        }
    }
    onProgress(30);
    return enrichedKlines;
};

const getValueFromEnrichedKline = (kline: EnrichedKline, indicator: IndicatorName, parameter: string) => {
    switch (indicator) {
        case 'Quantitative Score':
            if (parameter === 'composite_score') return kline.indicators.Quantitative_Score_Composite;
            if (parameter === 'structural_score') return kline.indicators.Quantitative_Score_Structural;
            return null;
        case 'CRF':
            return kline.indicators.CRF_Regime;
        case 'VPE':
            return kline.indicators.VPE;
        case 'Volatility':
            if (parameter === 'bollinger_band_width_pct') return kline.indicators.BBW_PCT;
            if (parameter === 'historical_volatility_rank') return kline.indicators.Volatility_HV_Rank;
            if (parameter === 'keltner_channels_squeeze') return kline.indicators.Volatility_Squeeze_Status;
            return null;
        case 'BTC Correlation':
            return kline.indicators.BTC_Correlation_Relative_Perf;
        case 'HVN Migration':
            if (parameter === 'status') return kline.indicators.HVN_Migration_Status;
            return null;
        case 'Chimera':
            if (parameter === 'fer') return kline.indicators.Chimera_FER;
            if (parameter === 'vdr') return kline.indicators.Chimera_VDR;
            if (parameter === 'mfi_v') return kline.indicators.Chimera_MFI_V;
            return null;
        default:
            return null;
    }
};

const checkLocationalCondition = (
    side: 'Long' | 'Short', 
    kline: EnrichedKline, 
    locationalCondition: StrategyConfig['long_strategy']['locational_condition'],
    confluenceZones: ConfluenceZone[]
): boolean => {
    if (!locationalCondition.enabled) return true;

    const price = side === 'Long' ? kline.low : kline.high;
    const requiredZoneType = side === 'Long' ? 'support' : 'resistance';

    return confluenceZones.some(zone => 
        zone.type === requiredZoneType &&
        price >= zone.range[0] &&
        price <= zone.range[1] &&
        zone.score >= locationalCondition.min_score
    );
};


const checkEntryConditions = (filters: ContextualFilter[], kline: EnrichedKline): boolean => {
    if (!filters || filters.length === 0) return false;

    return filters.every(filter => {
        const actualValue = getValueFromEnrichedKline(kline, filter.indicator, filter.parameter);
        if (actualValue === null || actualValue === undefined) {
            return false;
        }
        
        const expectedValue = filter.value;
        let result = false;
        switch (filter.operator) {
            case '>': result = actualValue > expectedValue; break;
            case '<': result = actualValue < expectedValue; break;
            case '=': result = String(actualValue) == String(expectedValue); break;
            case '!=': result = String(actualValue) != String(expectedValue); break;
            case 'contains': result = String(actualValue).includes(String(expectedValue)); break;
            case 'does not contain': result = !String(actualValue).includes(String(expectedValue)); break;
            default: result = false;
        }
        return result;
    });
};

const generateHistoricalReports = (
    allReports: FullReport[],
    primaryKlineIndex: number,
    primaryKlines: ProcessedKline[]
): FullReport[] => {
    const currentTimestamp = primaryKlines[primaryKlineIndex].timestamp;
    const historicalReports: FullReport[] = [];

    for (const report of allReports) {
        let reportCandleIndex = -1;
        for (let j = 0; j < report.kline_data.length; j++) {
            if (report.kline_data[j].timestamp <= currentTimestamp) {
                reportCandleIndex = j;
            } else {
                break; 
            }
        }
        if (reportCandleIndex === -1) continue;

        const klineSlice = report.kline_data.slice(0, reportCandleIndex + 1);

        if (klineSlice.length < 52) { 
            continue;
        }

        const closes = klineSlice.map(k => k.close);
        const highs = klineSlice.map(k => k.high);
        const lows = klineSlice.map(k => k.low);

        const paSlice = klineSlice.slice(-20);
        const price_action_levels = {
            type: "Price Action",
            basis: "Highest high and lowest low over last 20 periods",
            support: paSlice.length > 0 ? Math.min(...paSlice.map(k => k.low)) : null,
            resistance: paSlice.length > 0 ? Math.max(...paSlice.map(k => k.high)) : null,
        };

        const vp = analyze_volume_profile(klineSlice);
        const volume_profile_levels = {
            type: "Volume-Based",
            basis: "Volume distribution",
            poc_point_of_control: vp.point_of_control_poc ?? null,
            vah_value_area_high: vp.value_area_high_vah ?? null,
            val_value_area_low: vp.value_area_low_val ?? null,
        };

        const vwap20 = calculateVWAP(klineSlice, 20).pop() ?? null;
        const atr20 = calculateATR(highs, lows, closes, 20).pop() ?? null;
        const volatility_projection_levels = {
            type: "Dynamic (Predictive)",
            basis: "VWAP +/- ATR",
            anchor_vwap: vwap20,
            resistances: { r1: vwap20 && atr20 ? vwap20 + 1 * atr20 : null, r2: vwap20 && atr20 ? vwap20 + 2 * atr20 : null, r3: vwap20 && atr20 ? vwap20 + 3 * atr20 : null },
            supports: { s1: vwap20 && atr20 ? Math.max(0, vwap20 - 1 * atr20) : null, s2: vwap20 && atr20 ? Math.max(0, vwap20 - 2 * atr20) : null, s3: vwap20 && atr20 ? Math.max(0, vwap20 - 3 * atr20) : null },
        };
        
        const bb20 = calculateBB(closes, 20, 2);
        const trend_following_levels = {
            type: "Dynamic (Trend-Following)",
            basis: "Moving averages and volatility bands",
            ema50: calculateEMA(closes, 50).pop() ?? null,
            ema200: calculateEMA(closes, 200).pop() ?? null,
            bollinger_upper: bb20.upper.pop() ?? null,
            bollinger_lower: bb20.lower.pop() ?? null,
        };
        
        const ichimoku = calculateIchimoku(highs, lows, { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 });
        const ichimoku_analysis = {
            tenkan_sen: ichimoku.tenkan[reportCandleIndex] ?? null,
            kijun_sen: ichimoku.kijun[reportCandleIndex] ?? null,
            senkou_a: ichimoku.senkouA[reportCandleIndex] ?? null,
            senkou_b: ichimoku.senkouB[reportCandleIndex] ?? null,
        };
        
        const historicalReport: FullReport = {
            ...report,
            key_levels: {
                price_action_levels,
                volume_profile_levels,
                fibonacci_pivot_levels: report.key_levels.fibonacci_pivot_levels,
                volatility_projection_levels,
                trend_following_levels,
            },
            ichimoku_analysis,
        } as FullReport;
        
        historicalReports.push(historicalReport);
    }
    return historicalReports;
};


const runSimulationLoop = async (
    enrichedKlines: EnrichedKline[],
    strategy: StrategyConfig,
    settings: BacktestSettings,
    historicalConfluenceZones: Map<number, ConfluenceZone[]>,
    onProgress: (progress: number) => void,
    isLoggingEnabled: boolean,
    onLog: (logName: string, data: any) => void
) => {
    let equity = settings.initialCapital;
    const equityCurve = [equity];
    const tradeLog: TradeLogEntry[] = [];
    let openPosition: {
        id: string; side: 'Long' | 'Short'; entryPrice: number;
        entryTimestamp: number; size: number; stopLoss: number | null; takeProfit: number | null;
    } | null = null;
    
    for (let i = 200; i < enrichedKlines.length; i++) {
        const currentKline = enrichedKlines[i];
        const currentConfluenceZones = historicalConfluenceZones.get(currentKline.timestamp) || [];

        if (openPosition) {
            let exitPrice: number | null = null;
            if (openPosition.side === 'Long') {
                if (openPosition.stopLoss && currentKline.low <= openPosition.stopLoss) exitPrice = openPosition.stopLoss;
                else if (openPosition.takeProfit && currentKline.high >= openPosition.takeProfit) exitPrice = openPosition.takeProfit;
            } else {
                if (openPosition.stopLoss && currentKline.high >= openPosition.stopLoss) exitPrice = openPosition.stopLoss;
                else if (openPosition.takeProfit && currentKline.low <= openPosition.takeProfit) exitPrice = openPosition.takeProfit;
            }

            if (exitPrice || i === enrichedKlines.length - 1) {
                const finalExitPrice = exitPrice || currentKline.close;
                const pnl = (openPosition.side === 'Long' ? (finalExitPrice - openPosition.entryPrice) : (openPosition.entryPrice - finalExitPrice)) * openPosition.size;
                equity += pnl;
                const entryValue = openPosition.entryPrice * openPosition.size;
                const profitPct = entryValue > 0 ? (pnl / entryValue) * 100 : 0;
                
                tradeLog.push({
                    id: openPosition.id, side: openPosition.side, entryTimestamp: openPosition.entryTimestamp,
                    entryPrice: openPosition.entryPrice, exitTimestamp: currentKline.timestamp,
                    exitPrice: finalExitPrice, profit: pnl, profitPct: profitPct,
                });
                openPosition = null;
            }
        }

        if (!openPosition) {
            let entrySignal: 'Long' | 'Short' | null = null;

            if (strategy.long_strategy.enabled) {
                const locationalMet = checkLocationalCondition('Long', currentKline, strategy.long_strategy.locational_condition, currentConfluenceZones);
                if(locationalMet) {
                    const contextualMet = checkEntryConditions(strategy.long_strategy.contextual_filters, currentKline);
                    if (contextualMet) entrySignal = 'Long';
                }
            }
            if (!entrySignal && strategy.short_strategy.enabled) {
                const locationalMet = checkLocationalCondition('Short', currentKline, strategy.short_strategy.locational_condition, currentConfluenceZones);
                if (locationalMet) {
                    const contextualMet = checkEntryConditions(strategy.short_strategy.contextual_filters, currentKline);
                    if (contextualMet) entrySignal = 'Short';
                }
            }

            if (entrySignal) {
                const entryPrice = currentKline.close;
                let positionSizeInQuote = settings.positionSizing.type === 'fixed_amount' ? settings.positionSizing.value : equity * (settings.positionSizing.value / 100);
                if (equity <= 0 || positionSizeInQuote <= 0) continue;
                
                const positionSizeInAsset = positionSizeInQuote / entryPrice;

                const sideConfig = entrySignal === 'Long' ? strategy.long_strategy : strategy.short_strategy;
                let stopLoss: number | null = null;
                let takeProfit: number | null = null;
                const currentAtr = currentKline.indicators.ATR20;
                const tradeId = `trade-${tradeLog.length + 1}`;
                const logData: any = {};
                
                if (currentAtr) {
                    const slConfig = sideConfig.risk_management.stop_loss;
                    const stopDistance = slConfig.type === 'atr_multiple' ? currentAtr * (slConfig.value as number) : entryPrice * ((slConfig.value as number) / 100);
                    stopLoss = entrySignal === 'Long' ? entryPrice - stopDistance : entryPrice + stopDistance;
                    
                    logData.stopLoss = {
                        type: slConfig.type, value: slConfig.value,
                        atrAtEntry: currentAtr, calculatedSlPrice: stopLoss
                    };

                    const tpConfig = sideConfig.risk_management.take_profit;
                    const risk = Math.abs(entryPrice - stopLoss);
                    let profitDistance;

                    if (tpConfig.type === 'confluence_zone') {
                        let targetZone: ConfluenceZone | undefined;
                        if (entrySignal === 'Long') {
                            targetZone = currentConfluenceZones
                                .filter(z => z.type === 'resistance' && z.range[0] > entryPrice)
                                .sort((a, b) => a.range[0] - b.range[0])[0];
                        } else {
                            targetZone = currentConfluenceZones
                                .filter(z => z.type === 'support' && z.range[1] < entryPrice)
                                .sort((a, b) => b.range[1] - a.range[1])[0];
                        }
                        
                        if (targetZone) {
                            const target = tpConfig.value as ConfluenceZoneExitTarget;
                            if (target === 'nearest_edge') {
                                takeProfit = entrySignal === 'Long' ? targetZone.range[0] : targetZone.range[1];
                            } else if (target === 'farthest_edge') {
                                takeProfit = entrySignal === 'Long' ? targetZone.range[1] : targetZone.range[0];
                            } else { // middle_of_zone
                                takeProfit = (targetZone.range[0] + targetZone.range[1]) / 2;
                            }
                        } else {
                            profitDistance = risk * 2.0; 
                            takeProfit = entrySignal === 'Long' ? entryPrice + profitDistance : entryPrice - profitDistance;
                        }
                        logData.takeProfit = {
                            type: tpConfig.type, value: tpConfig.value,
                            targetZoneFound: targetZone || 'None Found, used fallback RR 2.0',
                            calculatedTpPrice: takeProfit
                        };
                    } else {
                         profitDistance = tpConfig.type === 'risk_reward_ratio' ? risk * (tpConfig.value as number) : (tpConfig.type === 'atr_multiple' ? currentAtr * (tpConfig.value as number) : entryPrice * ((tpConfig.value as number) / 100));
                         takeProfit = entrySignal === 'Long' ? entryPrice + profitDistance : entryPrice - profitDistance;
                         logData.takeProfit = {
                            type: tpConfig.type, value: tpConfig.value,
                            riskAtEntry: risk, atrAtEntry: currentAtr,
                            calculatedTpPrice: takeProfit
                         };
                    }
                }

                if(isLoggingEnabled){
                    onLog(`risk_setup_${tradeId}`, {
                        entrySignal, entryPrice, ...logData
                    });
                }
                
                openPosition = {
                    id: tradeId, side: entrySignal, entryPrice,
                    entryTimestamp: currentKline.timestamp, size: positionSizeInAsset, stopLoss, takeProfit,
                };
            }
        }

        equityCurve.push(equity);
        if (i % 50 === 0) {
            const progress = 60 + ((i - 200) / (enrichedKlines.length - 200)) * 40;
            onProgress(progress);
            await sleep(0);
        }
    }
    return { tradeLog, equityCurve };
};

const calculatePerformanceMetrics = (
    tradeLog: TradeLogEntry[], 
    equityCurve: number[], 
    initialCapital: number
): BacktestResults => {
    const totalTrades = tradeLog.length;
    if (totalTrades === 0) {
        return { netProfit: 0, netProfitPct: 0, profitFactor: null, winRate: 0, maxDrawdown: 0, maxDrawdownPct: 0, totalTrades: 0, avgWin: null, avgLoss: null, tradeLog };
    }

    const winningTrades = tradeLog.filter(t => t.profit > 0);
    const losingTrades = tradeLog.filter(t => t.profit <= 0);
    const winRate = (winningTrades.length / totalTrades) * 100;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    
    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : null;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : null;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity;
    
    const netProfit = equityCurve[equityCurve.length - 1] - initialCapital;
    const netProfitPct = (netProfit / initialCapital) * 100;
    
    let peakEquity = -Infinity;
    let maxDrawdown = 0;
    for (const eq of equityCurve) {
        if (eq > peakEquity) peakEquity = eq;
        const drawdown = peakEquity - eq;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    const maxDrawdownPct = peakEquity > initialCapital ? (maxDrawdown / peakEquity) * 100 : 0;

    return {
        netProfit: Number(netProfit.toFixed(2)),
        netProfitPct: Number(netProfitPct.toFixed(2)),
        profitFactor: profitFactor ? Number(profitFactor.toFixed(2)) : null,
        winRate: Number(winRate.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
        totalTrades,
        avgWin: avgWin ? Number(avgWin.toFixed(2)) : null,
        avgLoss: avgLoss ? Number(avgLoss.toFixed(2)) : null,
        tradeLog,
    };
};


export const runBacktest = async (
    strategy: StrategyConfig,
    fullReport: FullReport,
    settings: BacktestSettings,
    onProgress: (progress: number) => void,
    btcKlines: ProcessedKline[],
    isLoggingEnabled: boolean,
    onLog: (logName: string, data: any) => void,
    allReports: FullReport[]
): Promise<BacktestResults> => {
    const logIfEnabled = (logName: string, data: any) => {
        if (isLoggingEnabled) {
            onLog(logName, data);
        }
    };

    const klines = fullReport.kline_data;
    if (klines.length < 200) throw new Error("Not enough kline data (<200) to run a backtest.");
    
    onProgress(5);
    logIfEnabled('backtest_settings', settings);
    logIfEnabled('raw_kline_data_1000', klines);
    await sleep(10);
    
    onProgress(10);
    logIfEnabled('backtest_phase', 'Enriching klines with chronologically pure indicators...');
    const enrichedKlines = await enrichKlineData(klines, btcKlines, onProgress);
    logIfEnabled('enriched_kline_data_with_indicators', enrichedKlines.slice(200));

    onProgress(30);
    logIfEnabled('backtest_phase', 'Calculating historical confluence zones for each candle...');
    const historicalConfluenceZones = new Map<number, ConfluenceZone[]>();
    
    const totalCandlesForConfluence = klines.length - 200;
    for (let i = 200; i < klines.length; i++) {
        const historicalReports = generateHistoricalReports(allReports, i, klines);
        const zones = findLevelConfluence(historicalReports, klines[i].close);
        historicalConfluenceZones.set(klines[i].timestamp, zones);

        if (i % 20 === 0) {
            const confluenceProgress = ((i - 200) / totalCandlesForConfluence) * 30; // Phase takes 30% (30->60)
            onProgress(30 + confluenceProgress);
            await sleep(0);
        }
    }
    logIfEnabled('historical_confluence_zones_map_sample', Object.fromEntries(Array.from(historicalConfluenceZones.entries()).slice(-5)));

    onProgress(60);
    
    const { tradeLog, equityCurve } = await runSimulationLoop(
        enrichedKlines,
        strategy,
        settings,
        historicalConfluenceZones,
        onProgress,
        isLoggingEnabled,
        onLog
    );

    onProgress(100);
    return calculatePerformanceMetrics(tradeLog, equityCurve, settings.initialCapital);
};