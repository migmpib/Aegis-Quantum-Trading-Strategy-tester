import React from 'react';
import type { ContextualFilter, IndicatorName, Operator } from '../types';
import { INDICATOR_CONFIG, OPERATORS } from '../strategy/indicators';

interface ConditionRowProps {
    filter: ContextualFilter;
    onUpdate: (updatedFilter: ContextualFilter) => void;
    onRemove: () => void;
    usedIndicators: Set<IndicatorName>;
}

const ConditionRow: React.FC<ConditionRowProps> = ({ filter, onUpdate, onRemove, usedIndicators }) => {
    const currentIndicatorConfig = INDICATOR_CONFIG[filter.indicator];
    const currentParamConfig = currentIndicatorConfig.parameters[filter.parameter];

    const handleIndicatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newIndicator = e.target.value as IndicatorName;
        const newIndicatorConfig = INDICATOR_CONFIG[newIndicator];
        const newDefaultParam = Object.keys(newIndicatorConfig.parameters)[0];
        const newParamConfig = newIndicatorConfig.parameters[newDefaultParam];
        
        onUpdate({
            ...filter,
            indicator: newIndicator,
            parameter: newDefaultParam,
            operator: newParamConfig.type === 'number' ? '>' : 'contains',
            value: newParamConfig.type === 'number' ? 0 : (newParamConfig.options ? newParamConfig.options[0] : ''),
        });
    };

    const handleParameterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newParameter = e.target.value;
        const newParamConfig = currentIndicatorConfig.parameters[newParameter];
        onUpdate({
            ...filter,
            parameter: newParameter,
            operator: newParamConfig.type === 'number' ? '>' : 'contains',
            value: newParamConfig.type === 'number' ? 0 : (newParamConfig.options ? newParamConfig.options[0] : ''),
        });
    };
    
    const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate({ ...filter, operator: e.target.value as Operator });
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onUpdate({ ...filter, value: currentParamConfig.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value });
    };

    const renderValueInput = () => {
        if (currentParamConfig.options) {
            return (
                <select 
                    value={filter.value} 
                    onChange={handleValueChange}
                    className="flex-grow bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                >
                    {currentParamConfig.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        }
        
        return (
            <input
                type={currentParamConfig.type === 'number' ? 'number' : 'text'}
                value={filter.value}
                onChange={handleValueChange}
                className="flex-grow w-full bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                step={currentParamConfig.type === 'number' ? 0.01 : undefined}
            />
        );
    };

    const availableOperators = currentParamConfig.type === 'number' ? OPERATORS.numeric : OPERATORS.string;

    return (
        <div className="flex items-center gap-2 text-sm">
            <select value={filter.indicator} onChange={handleIndicatorChange} className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                {Object.keys(INDICATOR_CONFIG).map(nameStr => {
                    const name = nameStr as IndicatorName;
                    const isUsed = usedIndicators.has(name);
                    const isSelf = name === filter.indicator;
                    return (
                        <option key={name} value={name} disabled={isUsed && !isSelf}>
                            {name}
                        </option>
                    );
                })}
            </select>
            <select value={filter.parameter} onChange={handleParameterChange} className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                {Object.keys(currentIndicatorConfig.parameters).map(param => <option key={param} value={param}>{currentIndicatorConfig.parameters[param].label}</option>)}
            </select>
             <select value={filter.operator} onChange={handleOperatorChange} className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                {availableOperators.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <div className="flex-grow">
                {renderValueInput()}
            </div>
            <button onClick={onRemove} className="text-red-400 hover:text-red-300 font-bold text-lg p-1 rounded-full flex items-center justify-center h-6 w-6">
                &times;
            </button>
        </div>
    );
};

export default ConditionRow;