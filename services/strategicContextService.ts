
import type { FullReport, StrategicContext, FearAndGreedIndex } from '../types';

/**
 * This is the Aegis Strategic Context Engine.
 * It analyzes only high-timeframe (HTF) reports (Daily and 4-hour) to establish a stable,
 * overarching market context. This context serves as the "anchor" for all subsequent
 * tactical analysis, ensuring consistency.
 */
export const getStrategicContext = (htfReports: FullReport[], fearAndGreedIndex: FearAndGreedIndex | null): StrategicContext => {
    const reportD = htfReports.find(r => r.asset_info.timeframe === 'D');
    const report4h = htfReports.find(r => r.asset_info.timeframe === '240');

    if (!reportD || !report4h) {
        return {
            dominantBias: "Neutral / Ranging",
            confidenceScore: 0,
            recommendedStrategyProfile: "Indeterminate",
            summary: "Insufficient high-timeframe data (Daily or 4h missing) to determine a stable strategic context."
        };
    }
    
    // --- Technical Analysis ---
    let biasScore = 0;
    const reasons: string[] = [];

    // 1. Trend Structure (EMA)
    if (reportD.advanced_analysis.trend_ema === 'Bullish') { biasScore += 2; reasons.push("Daily EMA trend is Bullish."); }
    if (reportD.advanced_analysis.trend_ema === 'Bearish') { biasScore -= 2; reasons.push("Daily EMA trend is Bearish."); }
    if (report4h.advanced_analysis.trend_ema === 'Bullish') { biasScore += 1; reasons.push("4h EMA trend is Bullish."); }
    if (report4h.advanced_analysis.trend_ema === 'Bearish') { biasScore -= 1; reasons.push("4h EMA trend is Bearish."); }

    // 2. Market Regime (CRF)
    if (reportD.chimera_analysis.regime_filter_crf.includes('Trend')) { biasScore += reportD.chimera_analysis.regime_filter_crf.includes('Bullish') ? 2 : -2; reasons.push(`Daily market regime is trending.`); }
    if (report4h.chimera_analysis.regime_filter_crf.includes('Trend')) { biasScore += report4h.chimera_analysis.regime_filter_crf.includes('Bullish') ? 1 : -1; reasons.push(`4h market regime is trending.`); }
    if (reportD.chimera_analysis.regime_filter_crf.includes('Range')) { biasScore = Math.abs(biasScore) > 0 ? biasScore / 2 : 0; reasons.push(`Daily market is ranging, reducing trend conviction.`); }

    // 3. Volume Profile Context
    if (reportD.volume_profile_analysis.price_position_vs_va?.includes('Above')) { biasScore += 1.5; reasons.push("Price is above the Daily Value Area."); }
    if (reportD.volume_profile_analysis.price_position_vs_va?.includes('Below')) { biasScore -= 1.5; reasons.push("Price is below the Daily Value Area."); }

    // --- Determine Technical Bias ---
    let dominantBias: StrategicContext['dominantBias'] = "Neutral / Ranging";
    if (biasScore > 2) dominantBias = "Bullish";
    else if (biasScore < -2) dominantBias = "Bearish";
    
    // --- Sentiment Analysis as a Contextual Modifier ---
    let sentimentModifier = 1.0; // No modification by default
    if (fearAndGreedIndex) {
        const { value: fngValue } = fearAndGreedIndex;
        if (dominantBias === 'Bullish' && fngValue > 75) {
            sentimentModifier = 0.7; // Reduce confidence due to extreme greed (divergence)
            reasons.push("However, extreme market greed suggests euphoria and warrants caution.");
        } else if (dominantBias === 'Bearish' && fngValue < 25) {
            sentimentModifier = 0.7; // Reduce confidence due to extreme fear (potential capitulation)
            reasons.push("However, extreme market fear may signal potential capitulation, use caution.");
        } else if (dominantBias === 'Bullish' && fngValue < 30) {
            sentimentModifier = 1.2; // Increase confidence, structure is bullish while market is fearful (confluence)
            reasons.push("Market fear provides strong confirmation for the bullish technical structure.");
        } else if (dominantBias === 'Bearish' && fngValue > 70) {
            sentimentModifier = 1.2; // Increase confidence, structure is bearish while market is greedy (confluence)
            reasons.push("Market greed provides strong confirmation for the bearish technical structure.");
        }
    }

    // --- Determine Final Output ---
    let recommendedStrategyProfile: StrategicContext['recommendedStrategyProfile'] = "Indeterminate";
    if (dominantBias !== "Neutral / Ranging") {
        recommendedStrategyProfile = "Trend Following";
    } else {
        const isSqueezing = reportD.chimera_analysis.regime_filter_crf.includes('Squeeze') || report4h.chimera_analysis.regime_filter_crf.includes('Squeeze');
        const isRanging = reportD.chimera_analysis.regime_filter_crf.includes('Range') && report4h.chimera_analysis.regime_filter_crf.includes('Range');
        if(isSqueezing) {
             recommendedStrategyProfile = "Breakout Trading";
        } else if (isRanging) {
             recommendedStrategyProfile = "Mean Reversion";
        }
    }
    
    // Confidence is based on alignment. Max score is ~7.5, then modified by sentiment
    const baseConfidence = Math.min(100, Math.round((Math.abs(biasScore) / 7.5) * 100));
    const confidenceScore = Math.max(0, Math.min(100, Math.round(baseConfidence * sentimentModifier)));

    const summary = `The high-timeframe context shows a ${dominantBias.toLowerCase()} bias with ${confidenceScore}% confidence. ${reasons.slice(0, 3).join(' ')} The recommended strategic profile is '${recommendedStrategyProfile}'.`;

    return {
        dominantBias,
        confidenceScore,
        recommendedStrategyProfile,
        summary
    };
};
