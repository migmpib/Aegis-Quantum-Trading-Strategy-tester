import React from 'react';
import type { FullReport, ImmediateActionScoreReport, ConfluenceZone, ProcessedKline, OrderbookData, LiveLiquidation } from '../types';
import ImmediateActionScoreCard from './ImmediateActionScoreCard';
import PriceChart from './PriceChart';

interface ReportDisplayProps {
    report: FullReport;
    iasReport: ImmediateActionScoreReport | null;
    isIasLoading: boolean;
    confluenceZones: ConfluenceZone[];
    isConfluenceLoading: boolean;
    liveKlineData: ProcessedKline[];
    liveLiquidations: LiveLiquidation[];
}

const ReportCard: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={`bg-gray-800/60 border border-gray-700 rounded-lg shadow-md p-4 ${className} flex flex-col`}>
        <h3 className="text-lg font-semibold text-cyan-400 mb-3 border-b border-gray-600 pb-2">{title}</h3>
        <div className="flex-grow">{children}</div>
    </div>
);

const LiveLiquidationsCard: React.FC<{ liquidations: LiveLiquidation[]; assetInfo: FullReport['asset_info'] }> = ({ liquidations, assetInfo }) => {
    const reversedLiquidations = [...liquidations].reverse();
    const baseCoin = assetInfo.symbol.replace('USDT', '').replace('.P', '');

    const formatSize = (size: string) => {
        const numSize = parseFloat(size);
        if (numSize < 100) return numSize.toFixed(2);
        return numSize.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    return (
        <ReportCard title="Live Liquidations Feed" className="xl:col-span-1">
            <div className="h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {reversedLiquidations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center pt-16">Waiting for liquidation data...</p>
                )}
                <div className="space-y-1">
                    {reversedLiquidations.map((liq, index) => {
                        const isLongLiq = liq.side === 'Sell'; // Sell side liquidates a long position
                        const value = parseFloat(liq.price) * parseFloat(liq.size);
                        return (
                            <div key={`${liq.updatedTime}-${index}`} className="grid grid-cols-4 items-center gap-2 text-xs py-1 animate-fade-in-fast font-mono border-b border-gray-700/50 last:border-b-0">
                                <span className={`font-bold ${isLongLiq ? 'text-red-400' : 'text-green-400'}`}>
                                    {isLongLiq ? 'LONG LIQ' : 'SHORT LIQ'}
                                </span>
                                <span className="text-right">{formatSize(liq.size)}</span>
                                <span className="text-right">@ {parseFloat(liq.price).toLocaleString()}</span>
                                <span className="text-gray-400 text-right">
                                    ${value > 1000 ? `${(value/1000).toFixed(1)}K` : value.toFixed(0)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ReportCard>
    );
};

const DataRow: React.FC<{ label: string; value: React.ReactNode, valueClassName?: string }> = ({ label, value, valueClassName }) => (
    <div className="flex justify-between items-center text-sm py-1.5">
        <span className="text-gray-400">{label}</span>
        <span className={`font-mono text-gray-200 text-right ${valueClassName}`}>{value ?? 'N/A'}</span>
    </div>
);

const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score > 0.5) return 'text-green-400';
    if (score > 0.1) return 'text-green-500';
    if (score < -0.5) return 'text-red-400';
    if (score < -0.1) return 'text-red-500';
    return 'text-gray-400';
};

const getRegimeColor = (regime: string) => {
    if (regime.includes("Bullish")) return 'text-green-400';
    if (regime.includes("Bearish")) return 'text-red-400';
    if (regime.includes("Squeeze")) return 'text-yellow-400 font-bold';
    if (regime.includes("Range")) return 'text-blue-400';
    return 'text-gray-400';
}

const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return 'N/A';
    if (price < 1) {
        return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const KeyLevelsCard: React.FC<{ levels: FullReport['key_levels'] }> = ({ levels }) => {
    return (
        <ReportCard title="Key Levels Analysis" className="xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Section 1: Static & Volume */}
                <div className="space-y-3 bg-gray-900/30 p-2 rounded-md">
                    <h4 className="font-bold text-gray-300 text-sm">Structural Levels</h4>
                    
                    <div>
                        <p className="font-semibold text-purple-400">Volume Profile (Period)</p>
                        <DataRow label="Resistance (VAH)" value={formatPrice(levels.volume_profile_levels.vah_value_area_high)} valueClassName="text-red-400" />
                        <DataRow label="Magnet (POC)" value={formatPrice(levels.volume_profile_levels.poc_point_of_control)} />
                        <DataRow label="Support (VAL)" value={formatPrice(levels.volume_profile_levels.val_value_area_low)} valueClassName="text-green-400" />
                    </div>
                    
                    <div>
                         <p className="font-semibold text-purple-400">Price Action (20 bars)</p>
                         <DataRow label="Resistance (Swing)" value={formatPrice(levels.price_action_levels.resistance)} valueClassName="text-red-400" />
                         <DataRow label="Support (Swing)" value={formatPrice(levels.price_action_levels.support)} valueClassName="text-green-400" />
                    </div>
                </div>

                {/* Section 2: Predictive Daily Pivots */}
                <div className="space-y-3 bg-gray-900/30 p-2 rounded-md">
                    <h4 className="font-bold text-gray-300 text-sm">Predictive Levels (Daily)</h4>
                    {'error' in levels.fibonacci_pivot_levels ? (
                         <p className="text-gray-500">{levels.fibonacci_pivot_levels.error}</p>
                    ) : (
                        <div>
                            <p className="font-semibold text-purple-400">Fibonacci Pivots</p>
                            <DataRow label="R3" value={formatPrice(levels.fibonacci_pivot_levels.resistances?.r3)} valueClassName="text-red-500" />
                            <DataRow label="R2" value={formatPrice(levels.fibonacci_pivot_levels.resistances?.r2)} valueClassName="text-red-400" />
                            <DataRow label="R1" value={formatPrice(levels.fibonacci_pivot_levels.resistances?.r1)} valueClassName="text-red-400" />
                            <DataRow label="Pivot Point" value={formatPrice(levels.fibonacci_pivot_levels.pp_pivot_point)} />
                            <DataRow label="S1" value={formatPrice(levels.fibonacci_pivot_levels.supports?.s1)} valueClassName="text-green-400" />
                            <DataRow label="S2" value={formatPrice(levels.fibonacci_pivot_levels.supports?.s2)} valueClassName="text-green-400" />
                            <DataRow label="S3" value={formatPrice(levels.fibonacci_pivot_levels.supports?.s3)} valueClassName="text-green-500" />
                        </div>
                    )}
                </div>

                {/* Section 3: Dynamic Levels */}
                <div className="space-y-3 bg-gray-900/30 p-2 rounded-md">
                    <h4 className="font-bold text-gray-300 text-sm">Dynamic Levels (Real-time)</h4>
                    
                    <div>
                         <p className="font-semibold text-purple-400">Volatility Projection</p>
                         <DataRow label="Upper Band (2*ATR)" value={formatPrice(levels.volatility_projection_levels.resistances.r2)} valueClassName="text-red-400" />
                         <DataRow label="Anchor (VWAP)" value={formatPrice(levels.volatility_projection_levels.anchor_vwap)} />
                         <DataRow label="Lower Band (2*ATR)" value={formatPrice(levels.volatility_projection_levels.supports.s2)} valueClassName="text-green-400" />
                    </div>
                    
                    <div>
                         <p className="font-semibold text-purple-400">Trend Following</p>
                         <DataRow label="Resistance (BB Upper)" value={formatPrice(levels.trend_following_levels.bollinger_upper)} valueClassName="text-red-400" />
                         <DataRow label="Support (EMA 50)" value={formatPrice(levels.trend_following_levels.ema50)} valueClassName="text-green-400" />
                    </div>
                </div>
            </div>
        </ReportCard>
    );
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, iasReport, isIasLoading, confluenceZones, isConfluenceLoading, liveKlineData, liveLiquidations }) => {
    
    // The report prop is now the single source of truth for all displayed data.
    const { 
        unification_analysis, 
        quantitative_score_analysis: score, 
        chimera_analysis,
        market_snapshot: snapshotData,
        derivatives_analysis: derivativesData,
        sentiment_analysis,
        asset_info,
        microstructure_analysis,
    } = report;

    const eri = unification_analysis.effort_vs_result_index_eri;
    const sentimentData = sentiment_analysis?.fear_and_greed_index;
    const recent_liquidations_report = derivativesData.recent_liquidations_report;

    const msiProbabilities = Object.entries(unification_analysis.market_state_index_msi.probabilities)
        .sort((a, b) => (b[1] as number) - (a[1] as number));

    const getSentimentColor = (classification: string | undefined) => {
        if (!classification) return 'text-gray-300';
        if (classification.includes("Extreme Fear")) return 'text-red-400';
        if (classification.includes("Fear")) return 'text-orange-400';
        if (classification.includes("Greed")) return 'text-green-400';
        if (classification.includes("Extreme Greed")) return 'text-green-300';
        return 'text-gray-300';
    };

    const changePct = snapshotData.price_24h_change_pct;
    const periodChangePct = snapshotData.period_change_pct;

    return (
        <div className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                {/* Quantitative Synthesis Card - Reworked */}
                <ReportCard title="Quantitative Synthesis" className="xl:col-span-4">
                    <div className="flex flex-col md:flex-row items-stretch justify-between gap-4">
                        
                        {/* Structural Bias */}
                        <div className="flex-1 bg-gray-900/50 p-4 rounded-lg text-center">
                            <h4 className="text-base font-semibold text-gray-300 mb-2">Structural Bias</h4>
                            <div className={`text-4xl font-bold ${getScoreColor(score.structural_score)}`}>{score.structural_score?.toFixed(2) ?? 'N/A'}</div>
                            <p className="text-sm text-gray-400 mt-1">{score.structural_interpretation}</p>
                            <p className="text-xs text-purple-400 mt-2">Dominant State: {score.dominant_state_from_msi}</p>
                        </div>

                        {/* Operator */}
                        <div className="flex items-center justify-center">
                            <span className={`text-4xl font-bold ${score.flow_modifier >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {score.flow_modifier >= 0 ? '+' : ''}
                            </span>
                        </div>

                        {/* Real-time Flow */}
                        <div className="flex-1 bg-gray-900/50 p-4 rounded-lg text-center">
                            <h4 className="text-base font-semibold text-gray-300 mb-2">Real-time Flow</h4>
                            <div className={`text-4xl font-bold ${getScoreColor(score.flow_modifier * 3)}`}>{Math.abs(score.flow_modifier).toFixed(2)}</div>
                            <p className="text-sm text-gray-400 mt-1 h-10 overflow-y-auto">{score.flow_interpretation || 'Neutral Flow'}</p>
                        </div>

                        {/* Operator */}
                        <div className="flex items-center justify-center">
                            <span className="text-4xl font-bold text-cyan-400">=</span>
                        </div>
                        
                        {/* Composite Score */}
                        <div className="flex-1 bg-cyan-900/30 border border-cyan-700 p-4 rounded-lg text-center">
                            <h4 className="text-base font-semibold text-cyan-300 mb-2">Composite Score</h4>
                            <div className={`text-5xl font-bold ${getScoreColor(score.composite_score)}`}>{score.composite_score?.toFixed(2) ?? 'N/A'}</div>
                            <p className="text-sm text-cyan-400 mt-1">{score.interpretation.split('.')[0]}</p>
                        </div>
                    </div>
                </ReportCard>
                
                <KeyLevelsCard levels={report.key_levels} />
                
                <ReportCard title="Derivatives" className="xl:col-span-1">
                     <div className="grid grid-cols-1 gap-x-4">
                        <div>
                            <DataRow label="Open Interest" value={derivativesData.open_interest_value?.toLocaleString()} />
                            <DataRow label="OI Delta (4h %)" value={derivativesData.open_interest_delta_4h_pct} />
                            <DataRow label="Funding Rate" value={derivativesData.funding_rate} />
                            <DataRow label="Long/Short Ratio" value={derivativesData.long_short_ratio} />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-300 mt-2 mb-1">Initial Liquidations</h4>
                             <p className="text-xs text-gray-500 mb-2">{recent_liquidations_report.status}</p>
                             {recent_liquidations_report.total_liquidated_usd != null && recent_liquidations_report.total_liquidated_usd > 0 ? (
                                <>
                                    <DataRow label="Total Liq. (USD)" value={recent_liquidations_report.total_liquidated_usd?.toLocaleString(undefined, {maximumFractionDigits: 0})}/>
                                    <DataRow label="Dominant Side" value={recent_liquidations_report.dominant_side} />
                                </>
                            ) : null}
                        </div>
                    </div>
                </ReportCard>
                
                <LiveLiquidationsCard liquidations={liveLiquidations} assetInfo={asset_info} />
                
                <ReportCard title="Unification Analysis" className="xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-300 mb-2">Market State Index (MSI)</h4>
                            {msiProbabilities.map(([state, prob]) => (
                                <div key={state} className="text-xs mb-1.5">
                                    <div className="flex justify-between mb-0.5">
                                        <span>{state}</span>
                                        <span>{prob}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                                        <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${prob}%`}}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-1">Conviction Index (MCI)</h4>
                                <DataRow label="Signal Type" value={unification_analysis.multi_layer_conviction_index_mci.type} />
                                <DataRow label="Signal" value={unification_analysis.multi_layer_conviction_index_mci.signal} />
                                <DataRow label="Conviction" value={`${unification_analysis.multi_layer_conviction_index_mci.conviction}%`} />
                                {unification_analysis.multi_layer_conviction_index_mci.pattern && <DataRow label="Pattern" value={unification_analysis.multi_layer_conviction_index_mci.pattern} />}
                            </div>
                            <div className="pt-2 border-t border-gray-700/50">
                                <h4 className="text-sm font-semibold text-gray-300 mb-1">Effort/Result Index (ERI)</h4>
                                <DataRow label="Interpretation" value={eri.interpretation} />
                                <DataRow label="Buy / Sell Vol" value={`${eri.buy_volume?.toLocaleString() ?? 'N/A'} / ${eri.sell_volume?.toLocaleString() ?? 'N/A'}`} />
                                <DataRow label="Volume Delta" value={eri.volume_delta?.toLocaleString() ?? 'N/A'} />
                                <DataRow label="Largest Trade" value={`${eri.largest_trade_side} ${eri.largest_trade_size?.toLocaleString() ?? 'N/A'}`} />
                            </div>
                        </div>
                    </div>
                </ReportCard>

                <ReportCard title="Market Snapshot" className="md:col-span-1 xl:col-span-1">
                    <DataRow label="Last Price" value={`$${formatPrice(snapshotData.close_price)}`} valueClassName="text-lg font-bold" />
                    <DataRow 
                        label="24h Change" 
                        value={changePct !== null ? `${changePct.toFixed(2)}%` : 'N/A'}
                        valueClassName={changePct === null ? 'text-gray-400' : changePct >= 0 ? 'text-green-500' : 'text-red-500'}
                    />
                    <DataRow label="24h Volume" value={snapshotData.volume_24h.toLocaleString()} />
                    <div className="my-2 border-t border-gray-700/50"></div>
                    <DataRow 
                        label={`${snapshotData.interval_label} Change`}
                        value={periodChangePct !== null ? `${periodChangePct.toFixed(2)}%` : 'N/A'}
                        valueClassName={periodChangePct === null ? '' : (periodChangePct >= 0 ? 'text-green-500' : 'text-red-500')}
                    />
                    <DataRow 
                        label={`${snapshotData.interval_label} Volume`}
                        value={snapshotData.period_volume?.toLocaleString() ?? 'N/A'}
                    />
                </ReportCard>
                
                <ReportCard title="Advanced Analysis">
                    <DataRow label="EMA Trend (50/200)" value={report.advanced_analysis.trend_ema} valueClassName={report.advanced_analysis.trend_ema === 'Bullish' ? 'text-green-500' : 'text-red-500'} />
                    <DataRow label="Market Regime (ADX)" value={report.advanced_analysis.market_regime_adx} />
                    <DataRow label="RSI Divergence" value={report.advanced_analysis.divergences.rsi_divergence} />
                    <DataRow label="OBV Divergence" value={report.advanced_analysis.divergences.obv_divergence} />
                </ReportCard>
                
                <ReportCard title="Standard Indicators">
                    <DataRow label="EMA 50" value={formatPrice(report.standard_indicators.EMA_50)} />
                    <DataRow label="EMA 200" value={formatPrice(report.standard_indicators.EMA_200)} />
                    <DataRow label="RSI 14" value={report.standard_indicators.RSI_14} />
                    <DataRow label="ADX 14" value={report.standard_indicators.ADX_14} />
                </ReportCard>
                
                <ReportCard title="Volatility Analysis">
                    <DataRow label="Bollinger Band Width %" value={report.volatility_analysis.bollinger_band_width_pct} />
                    <DataRow 
                        label="Squeeze Status" 
                        value={report.volatility_analysis.keltner_channels_squeeze} 
                        valueClassName={report.volatility_analysis.keltner_channels_squeeze === 'SQUEEZE_DETECTED' ? 'text-yellow-400 font-bold' : ''}
                    />
                </ReportCard>

                <ReportCard title="BTC Correlation (20-period)">
                    {(() => {
                        const correlation = report.correlation_analysis;
                        if ('error' in correlation && correlation.error) {
                            return <span className="text-sm text-gray-500">{correlation.error}</span>;
                        }

                        if ('correlation_coefficient_20p' in correlation) {
                            return (
                                <>
                                    <DataRow label="Coefficient" value={correlation.correlation_coefficient_20p ?? 'N/A'} />
                                    <DataRow label="Interpretation" value={correlation.correlation_interpretation} />
                                    {correlation.relative_performance && (
                                        <DataRow
                                            label="Relative Performance"
                                            value={`${correlation.relative_performance} (${correlation.relative_performance_pct_diff}%)`}
                                            valueClassName={!correlation.relative_performance_pct_diff ? '' : correlation.relative_performance_pct_diff > 0 ? 'text-green-500' : 'text-red-500'}
                                        />
                                    )}
                                </>
                            );
                        }

                        // Fallback for the non-CorrelationReport object (BTCUSDT case)
                        return (
                            <>
                                <DataRow label="Interpretation" value={correlation.correlation_interpretation} />
                            </>
                        );
                    })()}
                </ReportCard>

                <ReportCard title="Volume Profile">
                    <DataRow label="Point of Control (POC)" value={formatPrice(report.volume_profile_analysis.point_of_control_poc)} />
                    <DataRow label="Value Area High (VAH)" value={formatPrice(report.volume_profile_analysis.value_area_high_vah)} />
                    <DataRow label="Value Area Low (VAL)" value={formatPrice(report.volume_profile_analysis.value_area_low_val)} />
                    <DataRow label="Price vs VA" value={report.volume_profile_analysis.price_position_vs_va} />
                </ReportCard>
                
                <ReportCard title="Chimera Analysis">
                    <DataRow label="Regime Filter (CRF)" value={chimera_analysis.regime_filter_crf} valueClassName={getRegimeColor(chimera_analysis.regime_filter_crf)} />
                    <div className="my-2 border-t border-gray-700/50"></div>
                    <DataRow label="Momentum Flow Index (MFI-V)" value={chimera_analysis.momentum_flow_index_mfi_v} />
                    <DataRow label="Volatility Potential (VPE)" value={chimera_analysis.volatility_potential_energy_vpe} />
                    <DataRow label="VWAP Deviation (VDR)" value={chimera_analysis.vwap_deviation_ratio_vdr} />
                    <DataRow label="Fractal Efficiency (FER)" value={chimera_analysis.fractal_efficiency_ratio_fer} />
                    <div className="my-2 border-t border-gray-700/50"></div>
                    <DataRow label="ATR (20-period)" value={report.extra_indicators.ATR_20} />
                    <DataRow label="+DI (14)" value={report.extra_indicators.PDI_14} valueClassName="text-green-400" />
                    <DataRow label="-DI (14)" value={report.extra_indicators.MDI_14} valueClassName="text-red-400" />
                </ReportCard>

                <ReportCard title="Ichimoku Cloud">
                    {report.ichimoku_analysis.error ? <span className="text-sm text-gray-500">{report.ichimoku_analysis.error}</span> : <>
                        <DataRow label="Trend" value={report.ichimoku_analysis.trend} />
                        <DataRow label="Momentum" value={report.ichimoku_analysis.momentum} />
                        <DataRow label="Future Outlook" value={report.ichimoku_analysis.future_outlook} />
                        <div className="my-2 border-t border-gray-700/50"></div>
                        <h4 className="text-xs font-semibold text-gray-400 mb-1">Key Levels</h4>
                        <DataRow label="Tenkan-sen" value={formatPrice(report.ichimoku_analysis.tenkan_sen)} />
                        <DataRow label="Kijun-sen" value={formatPrice(report.ichimoku_analysis.kijun_sen)} />
                        <DataRow label="Senkou A (Future)" value={formatPrice(report.ichimoku_analysis.senkou_a)} />
                        <DataRow label="Senkou B (Future)" value={formatPrice(report.ichimoku_analysis.senkou_b)} />
                    </>}
                </ReportCard>

                <ReportCard title="Market Sentiment (BTC)">
                    {sentimentData ? (
                        <>
                            <DataRow 
                                label="Fear & Greed Index" 
                                value={sentimentData.value} 
                            />
                            <DataRow 
                                label="Classification" 
                                value={sentimentData.value_classification} 
                                valueClassName={getSentimentColor(sentimentData.value_classification)}
                            />
                        </>
                    ) : (
                        <DataRow label="Status" value="Data not available" />
                    )}
                </ReportCard>

                <ImmediateActionScoreCard isLoading={isIasLoading} report={iasReport} />
            </div>

            <PriceChart
                klineData={liveKlineData}
                confluenceZones={confluenceZones}
                isLoading={isConfluenceLoading}
                atr={report.extra_indicators.ATR_20}
                assetInfo={report.asset_info}
                orderbook={microstructure_analysis.orderbook_liquidity}
            />
        </div>
    );
};

export default ReportDisplay;