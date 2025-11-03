
import type { FullReport, StrategicContext, ImmediateActionScoreReport, FearAndGreedIndex } from '../types';
import { safeRound } from './taUtils';
import { getStrategicContext } from './strategicContextService';

export const calculateImmediateActionScore = (
    primaryReport: FullReport,
    allReports: FullReport[],
    fearAndGreedIndex: FearAndGreedIndex | null
): Omit<ImmediateActionScoreReport, 'interpretation'> => {
    // FIX: The strategic context is now derived internally to ensure the function is self-contained and to resolve signature mismatch errors.
    const htfReports = allReports.filter(r => ['240', 'D'].includes(r.asset_info.timeframe));
    const strategicContext = getStrategicContext(htfReports, fearAndGreedIndex);

    // 1. Calculate HTF Vector (Weight: 20%)
    const htfBias = strategicContext.dominantBias === 'Bullish' ? 1 : strategicContext.dominantBias === 'Bearish' ? -1 : 0;
    const htfConfidence = strategicContext.confidenceScore / 100;
    const htfVector = htfBias * htfConfidence;

    // 2. Calculate Tactical Vector (Weight: 40%)
    const tacticalVector = primaryReport.quantitative_score_analysis.composite_score;

    // 3. Calculate Flow Vector (Weight: 40%)
    const mci = primaryReport.unification_analysis.multi_layer_conviction_index_mci;
    const mciSignal = mci.signal === 'Bullish' ? 1 : mci.signal === 'Bearish' ? -1 : 0;
    const flowVector = (mciSignal * (mci.conviction / 100));

    // 4. Determine Risk Appetite Modifier
    const dominantMsiState = primaryReport.unification_analysis.market_state_index_msi.dominantState;
    let riskAppetiteModifier = 1.0;
    if (dominantMsiState === "Choppy Range") {
        riskAppetiteModifier = 0.5;
    } else if (dominantMsiState === "Low-Vol Squeeze" || dominantMsiState === "Volatile Breakout") {
        riskAppetiteModifier = 1.2;
    }

    // 5. Calculate Final IAS
    const rawIAS = (htfVector * 0.2) + (tacticalVector * 0.4) + (flowVector * 0.4);
    let finalIAS = rawIAS * riskAppetiteModifier;

    // Clamp the final score to be within [-1, 1]
    finalIAS = Math.max(-1, Math.min(1, finalIAS));

    const direction = finalIAS > 0.1 ? 'Long' : finalIAS < -0.1 ? 'Short' : 'Neutral';

    const reasoning = `IAS breakdown: HTF(${safeRound(htfVector, 2)} * 0.2) + Tactical(${safeRound(tacticalVector, 2)} * 0.4) + Flow(${safeRound(flowVector, 2)} * 0.4) = ${safeRound(rawIAS, 2)}. Modified by x${riskAppetiteModifier} (${dominantMsiState}).`;

    return {
        score: safeRound(finalIAS, 2)!,
        direction,
        riskAppetiteModifier,
        reasoning,
    };
};
