
import React from 'react';
import type { StrategyProfilerReport, StrategicContext } from '../types';

interface StrategyProfilerCardProps {
    isLoading: boolean;
    report: StrategyProfilerReport | null;
    context: StrategicContext | null;
}

const getScoreColor = (score: number) => {
    if (score > 75) return 'bg-green-500';
    if (score > 50) return 'bg-yellow-500';
    return 'bg-gray-600';
};

const StrategyProfilerCard: React.FC<StrategyProfilerCardProps> = ({ isLoading, report, context }) => {
    if (isLoading) {
        return (
            <div className="bg-gray-800/60 border border-dashed border-gray-700 rounded-lg p-4 mb-4 animate-pulse">
                <div className="flex justify-center items-center">
                    <span className="text-lg font-semibold text-gray-300">Profiling tactical strategies...</span>
                </div>
            </div>
        );
    }
    
    if (!report || !context || report.strategies.length === 0) {
        return null;
    }

    return (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg shadow-lg p-4 mb-4 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-300 mb-3 border-b border-gray-600 pb-2">
                Tactical Strategy Profiler
            </h3>

            <div className="space-y-3">
                {report.strategies.map(strategy => (
                    <div key={strategy.name} className="bg-gray-900/50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                                <h5 className="font-semibold text-gray-200">{strategy.name}</h5>
                                {context.recommendedStrategyProfile === strategy.name && (
                                    <span className="text-xs font-bold bg-purple-600/50 text-purple-300 border border-purple-500 px-2 py-0.5 rounded-full">
                                        HTF Aligned
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Confirmation</span>
                                <div className="w-24 bg-gray-700 rounded-full h-2.5">
                                    <div 
                                        className={`${getScoreColor(strategy.confirmation_score)} h-2.5 rounded-full`} 
                                        style={{ width: `${strategy.confirmation_score}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-bold text-gray-300">{strategy.confirmation_score}%</span>
                            </div>
                        </div>
                        {strategy.analysis_narrative ? (
                            <p className="text-xs text-gray-300 mt-1 italic">
                                <span className="font-bold not-italic text-purple-400">AI Narrative: </span>
                                {strategy.analysis_narrative}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400">{strategy.description}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StrategyProfilerCard;
