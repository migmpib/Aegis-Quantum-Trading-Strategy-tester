import React, { useState } from 'react';
import type { BacktestSettings } from '../types';

interface BacktestSettingsModalProps {
    onClose: () => void;
    onStart: (settings: BacktestSettings) => void;
}

const BacktestSettingsModal: React.FC<BacktestSettingsModalProps> = ({ onClose, onStart }) => {
    const [settings, setSettings] = useState<BacktestSettings>({
        initialCapital: 10000,
        positionSizing: {
            type: 'percentage_of_equity',
            value: 5, // 5% of equity
        },
        fees: {
            makerPercent: 0.02,
            takerPercent: 0.05,
        },
        slippagePercent: 0.05,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
    };
    
    const handleNestedChange = (path: string[], value: any) => {
        setSettings(prev => {
            const newSettings = JSON.parse(JSON.stringify(prev));
            let current = newSettings;
            for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return newSettings;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStart(settings);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in-fast">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-xl font-bold text-gray-200 mb-4 border-b border-gray-600 pb-2">Backtest Settings</h2>
                    
                    <div className="space-y-4">
                        {/* Initial Capital */}
                        <div>
                           <label className="block text-sm font-medium text-gray-400 mb-1">Initial Capital (USDT)</label>
                           <input type="number" name="initialCapital" value={settings.initialCapital} onChange={handleInputChange} className="input-field" step="1000" />
                        </div>

                        {/* Position Sizing */}
                        <div>
                             <label className="block text-sm font-medium text-gray-400 mb-1">Position Sizing</label>
                             <div className="grid grid-cols-2 gap-2">
                                <select 
                                    value={settings.positionSizing.type} 
                                    onChange={e => handleNestedChange(['positionSizing', 'type'], e.target.value)} 
                                    className="input-field"
                                >
                                    <option value="percentage_of_equity">Percent of Equity</option>
                                    <option value="fixed_amount">Fixed Amount (USDT)</option>
                                </select>
                                <input 
                                    type="number" 
                                    value={settings.positionSizing.value} 
                                    onChange={e => handleNestedChange(['positionSizing', 'value'], parseFloat(e.target.value) || 0)} 
                                    className="input-field"
                                    step="0.5"
                                />
                             </div>
                        </div>

                        {/* Fees & Slippage */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Taker Fee (%)</label>
                                <input 
                                    type="number" 
                                    value={settings.fees.takerPercent} 
                                    onChange={e => handleNestedChange(['fees', 'takerPercent'], parseFloat(e.target.value) || 0)} 
                                    className="input-field"
                                    step="0.01"
                                />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Slippage (%)</label>
                                <input 
                                    type="number" 
                                    value={settings.slippagePercent} 
                                    onChange={e => handleNestedChange(['slippagePercent'], parseFloat(e.target.value) || 0)} 
                                    className="input-field"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition">
                            Run Test
                        </button>
                    </div>
                </form>
                {/* FIX: The `jsx` attribute is specific to frameworks like Next.js and is not supported in standard React, causing a type error. Removing the attribute makes this a standard <style> tag, which correctly applies the CSS within the component's scope. */}
                <style>{`
                    .input-field {
                        width: 100%;
                        background-color: #1F2937; /* bg-gray-800 */
                        border: 1px solid #4B5563; /* border-gray-600 */
                        border-radius: 0.375rem; /* rounded-md */
                        padding: 0.5rem 0.75rem; /* px-3 py-2 */
                        color: white;
                        transition: all 0.2s;
                    }
                    .input-field:focus {
                        outline: none;
                        border-color: #06B6D4; /* border-cyan-500 */
                        box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5); /* ring-2 ring-cyan-500 */
                    }
                `}</style>
            </div>
        </div>
    );
};

export default BacktestSettingsModal;