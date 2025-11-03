import React from 'react';

interface BacktestProgressProps {
    progress: number;
    onCancel: () => void;
}

const BacktestProgress: React.FC<BacktestProgressProps> = ({ progress, onCancel }) => {
    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 my-4 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-semibold text-gray-200">Backtest in Progress...</h4>
                    <p className="text-sm text-gray-400">Processing historical data, please wait.</p>
                </div>
                <button 
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition"
                >
                    Cancel
                </button>
            </div>
            <div className="mt-3">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-cyan-400">Progress</span>
                    <span className="text-sm font-medium text-cyan-400">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                        className="bg-cyan-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default BacktestProgress;