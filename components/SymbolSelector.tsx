
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BybitSymbol } from '../types';

interface SymbolSelectorProps {
    symbols: BybitSymbol[];
    selectedSymbol: string;
    onSelectSymbol: (symbol: string) => void;
}

const SymbolSelector: React.FC<SymbolSelectorProps> = ({ symbols, selectedSymbol, onSelectSymbol }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredSymbols = useMemo(() => {
        if (!searchTerm) {
            return symbols;
        }
        return symbols.filter(s =>
            s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [symbols, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleSelect = (symbol: string) => {
        onSelectSymbol(symbol);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white text-left flex justify-between items-center focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
            >
                <span>{selectedSymbol}</span>
                <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-gray-600 rounded-md shadow-lg max-h-60 flex flex-col">
                    <div className="p-2 border-b border-gray-700">
                        <input
                            type="text"
                            placeholder="Search symbol..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                    </div>
                    <ul className="overflow-y-auto">
                        {filteredSymbols.map(s => (
                            <li
                                key={s.symbol}
                                onClick={() => handleSelect(s.symbol)}
                                className={`px-4 py-2 cursor-pointer hover:bg-cyan-600/50 ${selectedSymbol === s.symbol ? 'bg-cyan-600/30' : ''}`}
                            >
                                {s.symbol}
                            </li>
                        ))}
                         {filteredSymbols.length === 0 && (
                            <li className="px-4 py-2 text-gray-500">No symbols found.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SymbolSelector;
