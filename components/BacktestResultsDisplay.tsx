import React from 'react';
import type { BacktestResults, TradeLogEntry } from '../types';

interface BacktestResultsDisplayProps {
    results: BacktestResults;
}

const MetricCard: React.FC<{ label: string; value: string | number | null; className?: string; isCurrency?: boolean }> = ({ label, value, className, isCurrency = false }) => {
    const formatValue = () => {
        if (value === null || value === undefined || (typeof value === 'number' && !isFinite(value))) return 'N/A';
        if (typeof value === 'number') {
            if (isCurrency) {
                 return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
             return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return value;
    };
    
    return (
        <div className="bg-gray-900/50 p-3 rounded-md text-center">
            <div className="text-sm text-gray-400">{label}</div>
            <div className={`text-xl font-bold ${className}`}>{formatValue()}</div>
        </div>
    );
};


const BacktestResultsDisplay: React.FC<BacktestResultsDisplayProps> = ({ results }) => {
    const { 
        netProfit, netProfitPct, profitFactor, winRate, 
        maxDrawdown, maxDrawdownPct, totalTrades, avgWin, avgLoss, tradeLog
    } = results;
    
    if (totalTrades === 0) {
        return (
            <div className="bg-gray-800/60 border border-dashed border-gray-700 rounded-lg p-8 my-4 animate-fade-in text-center">
                <h3 className="text-xl font-bold text-gray-200 mb-2">Backtest Complete</h3>
                <p className="text-gray-400">No trades were executed for the given strategy and historical data.</p>
                <p className="text-sm text-gray-500 mt-2">Consider adjusting the contextual filters to be less restrictive.</p>
            </div>
        );
    }


    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 my-4 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-600 pb-2">Backtest Results</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                 <MetricCard 
                    label="Net Profit" 
                    value={`${netProfitPct}%`}
                    className={netProfit > 0 ? 'text-green-400' : 'text-red-400'} 
                />
                <MetricCard 
                    label="Net Profit ($)" 
                    value={netProfit} 
                    isCurrency
                    className={netProfit > 0 ? 'text-green-400' : 'text-red-400'} 
                />
                <MetricCard label="Profit Factor" value={profitFactor} />
                <MetricCard label="Win Rate" value={`${winRate}%`} />
                <MetricCard label="Total Trades" value={totalTrades} />
                <MetricCard 
                    label="Max Drawdown" 
                    value={`${maxDrawdownPct}%`}
                    className="text-red-400"
                />
                 <MetricCard 
                    label="Max Drawdown ($)" 
                    value={maxDrawdown} 
                    isCurrency
                    className="text-red-400"
                />
                <MetricCard 
                    label="Avg. Win ($)" 
                    value={avgWin}
                    isCurrency 
                    className="text-green-400"
                />
                 <MetricCard 
                    label="Avg. Loss ($)" 
                    value={avgLoss} 
                    isCurrency
                    className="text-red-400"
                />
            </div>
            
            {/* Trade Log */}
             <div className="bg-gray-900/50 p-3 rounded-md">
                 <h4 className="text-md font-semibold text-gray-300 mb-2">Trade Log</h4>
                 <div className="overflow-auto max-h-80 relative">
                     <table className="w-full text-sm text-left text-gray-300">
                         <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
                             <tr>
                                 <th scope="col" className="px-4 py-2">Side</th>
                                 <th scope="col" className="px-4 py-2">Entry Time</th>
                                 <th scope="col" className="px-4 py-2 text-right">Entry Price</th>
                                 <th scope="col" className="px-4 py-2">Exit Time</th>
                                 <th scope="col" className="px-4 py-2 text-right">Exit Price</th>
                                 <th scope="col" className="px-4 py-2 text-right">Profit ($)</th>
                                 <th scope="col" className="px-4 py-2 text-right">Profit (%)</th>
                             </tr>
                         </thead>
                         <tbody className="font-mono">
                            {tradeLog.map((trade: TradeLogEntry) => (
                                <tr key={trade.id} className="bg-gray-900 border-b border-gray-700 hover:bg-gray-700/50">
                                    <td className={`px-4 py-2 font-semibold ${trade.side === 'Long' ? 'text-green-400' : 'text-red-400'}`}>
                                        {trade.side}
                                    </td>
                                    <td className="px-4 py-2">{new Date(trade.entryTimestamp).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right">{trade.entryPrice.toFixed(4)}</td>
                                    <td className="px-4 py-2">{new Date(trade.exitTimestamp).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-right">{trade.exitPrice.toFixed(4)}</td>
                                    <td className={`px-4 py-2 text-right ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {trade.profit.toFixed(2)}
                                    </td>
                                    <td className={`px-4 py-2 text-right ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {trade.profitPct.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                     </table>
                 </div>
            </div>
        </div>
    );
};

export default BacktestResultsDisplay;