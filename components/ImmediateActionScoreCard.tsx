
import React from 'react';
import type { ImmediateActionScoreReport } from '../types';

interface ImmediateActionScoreCardProps {
    isLoading: boolean;
    report: ImmediateActionScoreReport | null;
}

const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score > 0.5) return 'text-green-400';
    if (score > 0.1) return 'text-green-500';
    if (score < -0.5) return 'text-red-400';
    if (score < -0.1) return 'text-red-500';
    return 'text-gray-400';
};

const ImmediateActionScoreCard: React.FC<ImmediateActionScoreCardProps> = ({ isLoading, report }) => {
    if (isLoading) {
        return (
            <div className="bg-gray-800/60 border border-dashed border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto mt-2"></div>
                 <div className="h-8 bg-gray-700 rounded w-full mt-4"></div>
            </div>
        );
    }

    if (!report) return null;

    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg shadow-md p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3 border-b border-gray-600 pb-2">Immediate Action Score (IAS)</h3>
            <div className="text-center mb-3">
                <div className={`text-5xl font-bold ${getScoreColor(report.score)}`}>{report.score.toFixed(2)}</div>
                <div className="text-sm text-gray-400 mt-1">{report.direction} Signal</div>
            </div>
            {report.interpretation && (
                <div>
                    <h4 className="text-xs font-bold text-purple-400 mb-1">AI Interpretation & Recommendation</h4>
                    <p className="text-sm text-gray-300 italic">{report.interpretation}</p>
                </div>
            )}
        </div>
    );
};

export default ImmediateActionScoreCard;
