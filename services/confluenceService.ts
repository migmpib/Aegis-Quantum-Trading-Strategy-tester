import type { FullReport, ConfluenceZone, KeyLevels } from '../types';
import { safeRound } from './taUtils';

const TIMEFRAME_WEIGHTS: Record<string, number> = {
    'W': 1.0,
    'D': 0.9,
    '240': 0.7,
    '60': 0.5,
    '30': 0.3,
    '15': 0.2,
    '5': 0.1,
};

const LEVEL_TYPE_WEIGHTS: Record<string, number> = {
    // High significance
    'poc': 1.0,
    'pp': 0.9,
    'swing': 0.9,
    'ema200': 0.8,
    // Medium significance
    'vah': 0.7,
    'val': 0.7,
    'r3': 0.7,
    's3': 0.7,
    'atr3': 0.7,
    'kijun': 0.6,
    'senkou_b': 0.6,
    // Lower significance
    'r2': 0.5,
    's2': 0.5,
    'atr2': 0.5,
    'ema50': 0.5,
    'vwap': 0.5,
    'bb_upper': 0.4,
    'bb_lower': 0.4,
    'r1': 0.4,
    's1': 0.4,
    'atr1': 0.4,
    'tenkan': 0.3,
    'senkou_a': 0.3,
};

interface ExtractedLevel {
    price: number;
    type: string; // e.g., 'poc', 'ema50'
    timeframe: string; // e.g., '60', 'D'
    score: number;
    description: string;
}

function extractLevelsFromReport(report: FullReport): ExtractedLevel[] {
    const levels: ExtractedLevel[] = [];
    const tf = report.asset_info.timeframe;
    const tfWeight = TIMEFRAME_WEIGHTS[tf] || 0.1;

    const addLevel = (price: number | null | undefined, type: string, description: string) => {
        if (price !== null && price !== undefined && !isNaN(price)) {
            const typeWeight = LEVEL_TYPE_WEIGHTS[type] || 0.1;
            levels.push({
                price,
                type,
                timeframe: tf,
                score: tfWeight * typeWeight,
                description
            });
        }
    };
    
    const { key_levels, ichimoku_analysis } = report;

    // Price Action
    addLevel(key_levels.price_action_levels.support, 'swing', `Swing Low (${tf})`);
    addLevel(key_levels.price_action_levels.resistance, 'swing', `Swing High (${tf})`);
    
    // Volume Profile
    addLevel(key_levels.volume_profile_levels.poc_point_of_control, 'poc', `POC (${tf})`);
    addLevel(key_levels.volume_profile_levels.vah_value_area_high, 'vah', `VAH (${tf})`);
    addLevel(key_levels.volume_profile_levels.val_value_area_low, 'val', `VAL (${tf})`);

    // Pivots - CRITICAL FIX: Only extract from Daily timeframe to avoid artificial score inflation.
    if (tf === 'D' && !('error' in key_levels.fibonacci_pivot_levels)) {
        addLevel(key_levels.fibonacci_pivot_levels.pp_pivot_point, 'pp', `Pivot Point (Daily)`);
        // FIX: Added null-checks for optional properties `resistances` and `supports`.
        if (key_levels.fibonacci_pivot_levels.resistances) {
            Object.entries(key_levels.fibonacci_pivot_levels.resistances).forEach(([key, val]) => addLevel(val, key, `Pivot ${key.toUpperCase()} (Daily)`));
        }
        if (key_levels.fibonacci_pivot_levels.supports) {
            Object.entries(key_levels.fibonacci_pivot_levels.supports).forEach(([key, val]) => addLevel(val, key, `Pivot ${key.toUpperCase()} (Daily)`));
        }
    }
    
    // Volatility Projection
    addLevel(key_levels.volatility_projection_levels.anchor_vwap, 'vwap', `VWAP (${tf})`);
    // FIX: Removed unnecessary type casts.
    Object.entries(key_levels.volatility_projection_levels.resistances).forEach(([key, val]) => addLevel(val, `atr${key.slice(1)}`, `VWAP+ATR ${key.toUpperCase()} (${tf})`));
    Object.entries(key_levels.volatility_projection_levels.supports).forEach(([key, val]) => addLevel(val, `atr${key.slice(1)}`, `VWAP-ATR ${key.toUpperCase()} (${tf})`));

    // Trend Following
    addLevel(key_levels.trend_following_levels.ema50, 'ema50', `EMA 50 (${tf})`);
    addLevel(key_levels.trend_following_levels.ema200, 'ema200', `EMA 200 (${tf})`);
    addLevel(key_levels.trend_following_levels.bollinger_upper, 'bb_upper', `BB Upper (${tf})`);
    addLevel(key_levels.trend_following_levels.bollinger_lower, 'bb_lower', `BB Lower (${tf})`);
    
    // Ichimoku
    if (!('error' in ichimoku_analysis)) {
        addLevel(ichimoku_analysis.tenkan_sen, 'tenkan', `Tenkan Sen (${tf})`);
        addLevel(ichimoku_analysis.kijun_sen, 'kijun', `Kijun Sen (${tf})`);
        addLevel(ichimoku_analysis.senkou_a, 'senkou_a', `Senkou A (${tf})`);
        addLevel(ichimoku_analysis.senkou_b, 'senkou_b', `Senkou B (${tf})`);
    }

    return levels;
}


export const findLevelConfluence = (reports: FullReport[], lastStableClosePrice: number): ConfluenceZone[] => {
    if (reports.length === 0) return [];
    
    const allLevels = reports.flatMap(extractLevelsFromReport);
    allLevels.sort((a, b) => a.price - b.price);
    
    const CLUSTER_THRESHOLD_PCT = 0.005; // 0.5% of price
    const zones: { levels: ExtractedLevel[] }[] = [];

    if (allLevels.length > 0) {
        let currentZone = [allLevels[0]];
        for (let i = 1; i < allLevels.length; i++) {
            const level = allLevels[i];
            const lastLevelInZone = currentZone[currentZone.length - 1];
            
            // Use last level's price for threshold to keep it relative
            const threshold = lastLevelInZone.price * CLUSTER_THRESHOLD_PCT;

            // Since levels are sorted, we just check if the new level is close to the last one
            if (lastLevelInZone.price > 0 && (level.price - lastLevelInZone.price) <= threshold) {
                currentZone.push(level);
            } else {
                // Finalize the old zone and start a new one
                zones.push({ levels: currentZone });
                currentZone = [level];
            }
        }
        // Add the last zone
        zones.push({ levels: currentZone });
    }

    const confluenceZones: ConfluenceZone[] = zones
        .filter(zone => zone.levels.length > 1) // Only consider zones with more than one level
        .map(zone => {
            const prices = zone.levels.map(l => l.price);
            const range: [number, number] = [Math.min(...prices), Math.max(...prices)];
            const totalScore = zone.levels.reduce((sum, l) => sum + l.score, 0);
            const avgPrice = range[0] + (range[1] - range[0]) / 2;
            
            return {
                range,
                score: safeRound(totalScore, 2)!,
                reasons: zone.levels.map(l => l.description).sort(),
                // ** THE FIX **: Use the stable close price for classification, not the volatile live price.
                type: avgPrice > lastStableClosePrice ? 'resistance' : 'support',
            };
        });

    return confluenceZones.sort((a, b) => b.score - a.score);
};