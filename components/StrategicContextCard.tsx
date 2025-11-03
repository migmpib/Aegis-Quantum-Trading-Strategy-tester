
import React from 'react';
import type { StrategicContext } from '../types';

interface StrategicContextCardProps {
    isLoading: boolean;
    context: StrategicContext | null;
}

const getConfidenceColor = (score: number) => {
    if (score > 75) return 'text-green-400';
    if (score > 50) return 'text-yellow-400';
    return 'text-gray-400';
}

const getBiasColor = (bias: string) => {
    if (bias === 'Bullish') return 'bg-green-800/50 text-green-300 border-green-700';
    if (bias === 'Bearish') return 'bg-red-800/50 text-red-300 border-red-700';
    return 'bg-gray-700/50 text-gray-300 border-gray-600';
}

const StrategicContextCard: React.FC<StrategicContextCardProps> = ({ isLoading, context }) => {
    if (isLoading) {
        return (
             <div className="bg-gray-800/60 border border-dashed border-gray-700 rounded-lg p-4 mb-4 animate-pulse">
                <div className="flex justify-center items-center">
                     <span className="text-lg font-semibold text-gray-300">Determining Strategic Context from High Timeframes...</span>
                </div>
            </div>
        )
    }

    if (!context) {
        return null;
    }

    return (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg shadow-lg p-4 mb-4 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-300 mb-3 border-b border-gray-600 pb-2">
                Strategic Context (HTF Analysis)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className={`p-3 rounded-lg border ${getBiasColor(context.dominantBias)}`}>
                    <div className="text-sm uppercase text-gray-400">Dominant Bias</div>
                    <div className="text-2xl font-bold">{context.dominantBias}</div>
                </div>
                <div className="p-3 rounded-lg border border-gray-600">
                    <div className="text-sm uppercase text-gray-400">Confidence Score</div>
                    <div className={`text-2xl font-bold ${getConfidenceColor(context.confidenceScore)}`}>{context.confidenceScore}%</div>
                </div>
                <div className="p-3 rounded-lg border border-gray-600">
                    <div className="text-sm uppercase text-gray-400">Recommended Profile</div>
                    <div className="text-xl font-bold">{context.recommendedStrategyProfile}</div>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700/50">
                <p className="text-sm text-gray-300 leading-relaxed">{context.summary}</p>
            </div>
        </div>
    );
};

export default StrategicContextCard;
