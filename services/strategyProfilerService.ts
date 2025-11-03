
import type { FullReport, StrategyProfile, StrategyProfilerReport, StrategicContext } from '../types';

// Define the "ideal" conditions for each strategy
const STRATEGY_PROFILES = {
    "Trend Following": {
        description: "Capitalizes on sustained directional movements in the market.",
        rules: [
            // High weight: Clear trend signals on higher timeframes
            { metric: 'crf_4h', condition: (val: string) => val.includes('Trend'), weight: 25 },
            { metric: 'adx_4h', condition: (val: number) => val > 25, weight: 20 },
            { metric: 'fer_4h', condition: (val: number) => val > 0.5, weight: 15 },
            // Medium weight: Confirmation on primary timeframe
            { metric: 'crf_primary', condition: (val: string) => val.includes('Trend'), weight: 15 },
            { metric: 'msi_primary_trend', condition: (val: number) => val > 60, weight: 10 },
             // Low weight: Avoid counter-signals
            { metric: 'crf_primary_squeeze', condition: (val: string) => !val.includes('Squeeze'), weight: 5 },
            { metric: 'adx_primary', condition: (val: number) => val > 20, weight: 10 },
        ]
    },
    "Mean Reversion": {
        description: "Profits from price reverting to its average in ranging markets.",
        rules: [
            // High weight: Clear ranging signals
            { metric: 'crf_primary', condition: (val: string) => val.includes('Range'), weight: 25 },
            { metric: 'adx_primary', condition: (val: number) => val < 20, weight: 20 },
            { metric: 'msi_primary_range', condition: (val: number) => val > 60, weight: 15 },
             // Medium weight: Price is contained
            { metric: 'price_vs_va_primary', condition: (val: string) => val.includes('Inside'), weight: 15 },
            { metric: 'fer_primary', condition: (val: number) => val < 0.5, weight: 10 },
            // Low weight: Higher timeframes are not strongly trending
            { metric: 'adx_4h', condition: (val: number) => val < 30, weight: 10 },
        ]
    },
    "Breakout Trading": {
        description: "Enters a position when price breaks out of a consolidation pattern.",
        rules: [
            // High weight: Volatility compression is detected
            { metric: 'crf_primary_squeeze', condition: (val: string) => val.includes('Squeeze'), weight: 40 },
            { metric: 'vpe_primary', condition: (val: number) => val > 70, weight: 25 },
            // Medium weight: Low current volatility and trend strength
            { metric: 'adx_primary', condition: (val: number) => val < 25, weight: 15 },
            { metric: 'msi_primary_squeeze', condition: (val: number) => val > 50, weight: 10 },
            // Low weight: Price is inside value area, ready to break out
            { metric: 'price_vs_va_primary', condition: (val: string) => val.includes('Inside'), weight: 10 },
        ]
    }
};

const getMetric = (metricName: string, primaryReport: FullReport, report4h: FullReport | undefined, reportD: FullReport | undefined) => {
    switch (metricName) {
        case 'crf_4h': return report4h?.chimera_analysis.regime_filter_crf;
        case 'adx_4h': return report4h?.standard_indicators.ADX_14;
        case 'fer_4h': return report4h?.chimera_analysis.fractal_efficiency_ratio_fer;
        
        case 'crf_primary': return primaryReport.chimera_analysis.regime_filter_crf;
        case 'adx_primary': return primaryReport.standard_indicators.ADX_14;
        case 'msi_primary_trend': 
            return (primaryReport.unification_analysis.market_state_index_msi.probabilities['Stable Trend'] || 0) + 
                   (primaryReport.unification_analysis.market_state_index_msi.probabilities['Exhaustion Trend'] || 0);
        case 'msi_primary_range':
             return (primaryReport.unification_analysis.market_state_index_msi.probabilities['Stable Range'] || 0) + 
                   (primaryReport.unification_analysis.market_state_index_msi.probabilities['Choppy Range'] || 0);
        case 'msi_primary_squeeze':
            return primaryReport.unification_analysis.market_state_index_msi.probabilities['Low-Vol Squeeze'] || 0;
        case 'crf_primary_squeeze': return primaryReport.chimera_analysis.regime_filter_crf; // Re-used for a specific check
        case 'price_vs_va_primary': return primaryReport.volume_profile_analysis.price_position_vs_va;
        case 'fer_primary': return primaryReport.chimera_analysis.fractal_efficiency_ratio_fer;
        case 'vpe_primary': return primaryReport.chimera_analysis.volatility_potential_energy_vpe;
        default: return null;
    }
};

// FIX: Added the missing `selectedInterval` parameter to the function signature.
// This parameter is crucial for selecting the correct primary report from the list of all reports.
export const profileStrategies = (reports: FullReport[], context: StrategicContext, selectedInterval: string): StrategyProfilerReport => {
    if (reports.length === 0) return { strategies: [] };
    
    // Find the primary report based on the app's selected interval, not just the first one.
    const primaryReport = reports.find(r => r.asset_info.timeframe === selectedInterval) ?? reports[0];
    if (!primaryReport) return { strategies: [] };
    
    const report4h = reports.find(r => r.asset_info.timeframe === '240');
    const reportD = reports.find(r => r.asset_info.timeframe === 'D');

    const strategyScores: StrategyProfile[] = [];

    for (const [name, profile] of Object.entries(STRATEGY_PROFILES)) {
        let totalWeight = 0;
        let achievedScore = 0;

        for (const rule of profile.rules) {
            const value = getMetric(rule.metric, primaryReport, report4h, reportD);
            totalWeight += rule.weight;
            if (value !== null && value !== undefined && (rule.condition as any)(value)) {
                achievedScore += rule.weight;
            }
        }
        
        const confirmation_score = totalWeight > 0 ? Math.round((achievedScore / totalWeight) * 100) : 0;
        
        strategyScores.push({
            name: name as "Trend Following" | "Mean Reversion" | "Breakout Trading",
            confirmation_score,
            description: profile.description,
            analysis_narrative: null,
        });
    }

    const sortedStrategies = strategyScores
        .sort((a, b) => b.confirmation_score - a.confirmation_score)
        .filter(s => s.confirmation_score > 35) // Filter out very low-scoring strategies
        .slice(0, 3);
        
    return { strategies: sortedStrategies };
};
