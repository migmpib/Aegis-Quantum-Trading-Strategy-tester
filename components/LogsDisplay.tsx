import React, { useState } from 'react';

interface LogsDisplayProps {
    logs: Record<string, any>;
    isEnabled: boolean;
    setIsEnabled: (enabled: boolean) => void;
}

const LogsDisplay: React.FC<LogsDisplayProps> = ({ logs, isEnabled, setIsEnabled }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

    const toggleLogItem = (logName: string) => {
        setExpandedLogs(prev => ({ ...prev, [logName]: !prev[logName] }));
    };
    
    // Re-used from JsonDisplay for consistency
    const syntaxHighlight = (json: string) => {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'text-green-400'; // number
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'text-purple-400'; // key
                } else {
                    cls = 'text-cyan-400'; // string
                }
            } else if (/true|false/.test(match)) {
                cls = 'text-yellow-500'; // boolean
            } else if (/null/.test(match)) {
                cls = 'text-gray-500'; // null
            }
            return `<span class="${cls}">${match}</span>`;
        });
    };

    return (
        <div className={`bg-gray-900/70 border border-gray-700 rounded-lg shadow-inner h-full flex flex-col transition-all duration-300 ${isCollapsed ? 'max-h-16 overflow-hidden' : 'min-h-[200px]'}`}>
            <div className="flex justify-between items-center p-3 border-b border-gray-600">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-300">Logs</h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-300">{isEnabled ? 'On' : 'Off'}</span>
                    </label>
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded-md text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                    aria-label={isCollapsed ? "Expand logs view" : "Collapse logs view"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            </div>
            {!isCollapsed && (
                <div className="p-4 overflow-auto flex-grow">
                    {Object.keys(logs).length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <p>No logs generated yet.</p>
                            <p className="text-xs mt-1">Enable logging and run a backtest to see intermediate data.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {Object.entries(logs).map(([name, data]) => {
                                const isExpanded = !!expandedLogs[name];
                                const jsonString = isExpanded ? JSON.stringify(data, null, 2) : '';

                                return (
                                <div key={name} className="bg-gray-800/50 rounded-md overflow-hidden">
                                    <button
                                        onClick={() => toggleLogItem(name)}
                                        className="w-full flex justify-between items-center p-2 text-left hover:bg-gray-700/50 transition-colors"
                                    >
                                        <p className="font-mono text-sm text-cyan-400">{name}</p>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                    {isExpanded && (
                                         <pre className="p-2 text-xs font-mono overflow-auto bg-black/30 max-h-60">
                                            <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }} />
                                        </pre>
                                    )}
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LogsDisplay;