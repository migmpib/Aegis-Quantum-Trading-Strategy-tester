import React from 'react';
import type { ContextualFilter, IndicatorName } from '../types';
import ConditionRow from './ConditionRow';
import { INDICATOR_CONFIG } from '../strategy/indicators';

interface ConditionBuilderProps {
    filters: ContextualFilter[];
    onUpdate: (newFilters: ContextualFilter[]) => void;
    side: 'long' | 'short';
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({ filters, onUpdate, side }) => {
    const allIndicatorNames = Object.keys(INDICATOR_CONFIG) as IndicatorName[];
    const usedIndicatorNames = new Set(filters.map(f => f.indicator));
    
    const availableIndicators = allIndicatorNames.filter(name => !usedIndicatorNames.has(name));
    const canAddFilter = availableIndicators.length > 0;

    const handleAddFilter = () => {
        if (!canAddFilter) return;

        const indicatorToAdd = availableIndicators[0];
        const indicatorConfig = INDICATOR_CONFIG[indicatorToAdd];
        const defaultParam = Object.keys(indicatorConfig.parameters)[0];
        const paramConfig = indicatorConfig.parameters[defaultParam];
        
        const newFilter: ContextualFilter = {
            id: `${side}-${Date.now()}`,
            indicator: indicatorToAdd,
            parameter: defaultParam,
            operator: paramConfig.type === 'number' ? '>' : 'contains',
            value: paramConfig.type === 'number' ? 0 : (paramConfig.options ? paramConfig.options[0] : ''),
        };
        onUpdate([...filters, newFilter]);
    };

    const handleUpdateFilter = (updatedFilter: ContextualFilter) => {
        const newFilters = filters.map(f => f.id === updatedFilter.id ? updatedFilter : f);
        onUpdate(newFilters);
    };

    const handleRemoveFilter = (id: string) => {
        onUpdate(filters.filter(f => f.id !== id));
    };

    return (
        <div className="bg-gray-900/50 rounded-md p-3 space-y-3">
            {filters.map((filter) => (
                <ConditionRow
                    key={filter.id}
                    filter={filter}
                    onUpdate={handleUpdateFilter}
                    onRemove={() => handleRemoveFilter(filter.id)}
                    usedIndicators={usedIndicatorNames}
                />
            ))}
             <button
                onClick={handleAddFilter}
                disabled={!canAddFilter}
                className="w-full text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200 border-2 border-dashed border-gray-600 
                disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
                hover:enabled:bg-gray-700/50 hover:enabled:border-cyan-600 hover:enabled:text-cyan-300"
            >
                {canAddFilter ? '+ Add Filter' : 'All Filters Used'}
            </button>
        </div>
    );
};

export default ConditionBuilder;