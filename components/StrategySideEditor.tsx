import React from 'react';
import type { StrategySide, ContextualFilter, RiskManagement, ConfluenceZoneExitTarget } from '../types';
import ConditionBuilder from './ConditionBuilder';

interface StrategySideEditorProps {
    side: 'long' | 'short';
    config: StrategySide;
    onUpdate: (newConfig: StrategySide) => void;
}

const StrategySideEditor: React.FC<StrategySideEditorProps> = ({ side, config, onUpdate }) => {
    const sideName = side === 'long' ? 'Long' : 'Short';
    const accentColor = side === 'long' ? 'green' : 'red';

    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...config, enabled: e.target.checked });
    };
    
    const handleLocationalToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ 
            ...config, 
            locational_condition: { ...config.locational_condition, enabled: e.target.checked }
        });
    };

    const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newScore = parseFloat(e.target.value) || 0;
        onUpdate({ 
            ...config, 
            locational_condition: { ...config.locational_condition, min_score: newScore }
        });
    };
    
    const handleFiltersChange = (newFilters: ContextualFilter[]) => {
        onUpdate({ ...config, contextual_filters: newFilters });
    };

    const handleRiskManagementChange = (
        field: 'type' | 'value',
        exitType: 'stop_loss' | 'take_profit',
        newValue: any
    ) => {
        const newRiskManagement = { ...config.risk_management };
        let exitConfig = { ...newRiskManagement[exitType] };
    
        if (field === 'type' && exitType === 'take_profit') {
            exitConfig.type = newValue;
            if (newValue === 'confluence_zone') {
                exitConfig.value = 'nearest_edge'; // Default value for the new dropdown
            } else {
                 // When switching away from confluence_zone, reset to a default numeric value
                if (typeof exitConfig.value !== 'number') {
                    exitConfig.value = 2.0; 
                }
            }
        } else {
             // Handle numeric inputs for stop_loss and other take_profit types
            const finalValue = typeof exitConfig.value === 'number' && typeof newValue === 'string'
                ? parseFloat(newValue) || 0
                : newValue;
            exitConfig = { ...exitConfig, [field]: finalValue };
        }
    
        onUpdate({
            ...config,
            risk_management: {
                ...newRiskManagement,
                [exitType]: exitConfig,
            },
        });
    };


    return (
        <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-4 transition-opacity duration-300 ${!config.enabled ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-4 border-b border-gray-600 pb-3">
                <h3 className={`text-xl font-bold text-${accentColor}-400`}>{sideName} Strategy</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={config.enabled} onChange={handleToggle} className="sr-only peer" />
                    <div className={`w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-${accentColor}-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-${accentColor}-600`}></div>
                </label>
            </div>

            <div className={`space-y-4 ${!config.enabled ? 'pointer-events-none' : ''}`}>
                {/* Locational Condition */}
                <div>
                     <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-300">1. Locational Condition (Optional)</h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={config.locational_condition.enabled} onChange={handleLocationalToggle} className="sr-only peer" />
                            <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-gray-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                        </label>
                    </div>
                    <div className={`bg-gray-900/50 rounded-md p-3 transition-opacity ${!config.locational_condition.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                         <label htmlFor={`${side}-min-score`} className="block text-sm font-medium text-gray-400 mb-1">
                            Min. Confluence Zone Score
                         </label>
                         <input
                            type="number"
                            id={`${side}-min-score`}
                            step="0.1"
                            value={config.locational_condition.min_score}
                            onChange={handleScoreChange}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                        />
                    </div>
                </div>
                
                {/* Contextual Filters */}
                <div>
                    <h4 className="font-semibold text-gray-300 mb-2">2. Contextual Filters (All must be true)</h4>
                     <ConditionBuilder
                        filters={config.contextual_filters}
                        onUpdate={handleFiltersChange}
                        side={side}
                     />
                </div>

                {/* Risk Management */}
                <div>
                    <h4 className="font-semibold text-gray-300 mb-2">3. Risk Management & Exits</h4>
                    <div className="bg-gray-900/50 rounded-md p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Stop Loss */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-400">Stop Loss</label>
                            <select 
                                value={config.risk_management.stop_loss.type}
                                onChange={(e) => handleRiskManagementChange('type', 'stop_loss', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                            >
                                <option value="percentage">Percentage</option>
                                <option value="atr_multiple">ATR Multiple</option>
                            </select>
                            <input 
                                type="number"
                                value={config.risk_management.stop_loss.value as number}
                                onChange={(e) => handleRiskManagementChange('value', 'stop_loss', e.target.value)}
                                step="0.1"
                                className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                            />
                        </div>
                        {/* Take Profit */}
                         <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-400">Take Profit</label>
                            <select 
                                value={config.risk_management.take_profit.type}
                                onChange={(e) => handleRiskManagementChange('type', 'take_profit', e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                            >
                                <option value="percentage">Percentage</option>
                                <option value="atr_multiple">ATR Multiple</option>
                                <option value="risk_reward_ratio">Risk/Reward Ratio</option>
                                <option value="confluence_zone">Confluence Zone</option>
                            </select>
                            {config.risk_management.take_profit.type === 'confluence_zone' ? (
                                 <select 
                                    value={config.risk_management.take_profit.value as ConfluenceZoneExitTarget}
                                    onChange={(e) => handleRiskManagementChange('value', 'take_profit', e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                >
                                    <option value="nearest_edge">Nearest Edge</option>
                                    <option value="middle_of_zone">Middle of Zone</option>
                                    <option value="farthest_edge">Farthest Edge</option>
                                </select>
                            ) : (
                                <input 
                                    type="number"
                                    value={config.risk_management.take_profit.value as number}
                                    onChange={(e) => handleRiskManagementChange('value', 'take_profit', e.target.value)}
                                    step="0.1"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategySideEditor;