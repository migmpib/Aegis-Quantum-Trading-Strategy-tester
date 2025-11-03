
import React from 'react';
import type { BybitSymbol } from '../types';
import { CATEGORIES, INTERVALS } from '../constants';
import SymbolSelector from './SymbolSelector';

interface SelectorProps {
    symbols: BybitSymbol[];
    selectedSymbol: string;
    setSelectedSymbol: (symbol: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    selectedInterval: string;
    setSelectedInterval: (interval: string) => void;
    onGenerate: () => void;
    onStop: () => void;
    isLoading: boolean;
}

const Selector: React.FC<SelectorProps> = ({
    symbols,
    selectedSymbol,
    setSelectedSymbol,
    selectedCategory,
    setSelectedCategory,
    selectedInterval,
    setSelectedInterval,
    onGenerate,
    onStop,
    isLoading
}) => {
    return (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 md:p-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="flex flex-col">
                    <label htmlFor="category" className="mb-2 text-sm font-medium text-gray-400">Category</label>
                    <select
                        id="category"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    >
                        {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                </div>
                <div className="flex flex-col">
                    <label htmlFor="symbol-selector" className="mb-2 text-sm font-medium text-gray-400">Symbol</label>
                    <SymbolSelector
                        symbols={symbols}
                        selectedSymbol={selectedSymbol}
                        onSelectSymbol={setSelectedSymbol}
                    />
                </div>
                <div className="flex flex-col">
                    <label htmlFor="interval" className="mb-2 text-sm font-medium text-gray-400">Interval</label>
                    <select
                        id="interval"
                        value={selectedInterval}
                        onChange={(e) => setSelectedInterval(e.target.value)}
                        className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    >
                        {INTERVALS.map(int => <option key={int.value} value={int.value}>{int.label}</option>)}
                    </select>
                </div>
                <button
                    onClick={isLoading ? onStop : onGenerate}
                    className={`w-full text-white font-bold py-2 px-4 rounded-md transition-all duration-300 ease-in-out flex items-center justify-center ${
                        isLoading
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                        : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600'
                    }`}
                >
                    {isLoading ? 'Stop Analysis' : 'Generate Report'}
                </button>
            </div>
        </div>
    );
};

export default Selector;
