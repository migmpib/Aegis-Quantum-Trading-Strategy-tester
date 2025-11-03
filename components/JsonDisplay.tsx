import React, { useState, useEffect } from 'react';

interface JsonDisplayProps {
    data: object;
}

const JsonDisplay: React.FC<JsonDisplayProps> = ({ data }) => {
    const [copyStatus, setCopyStatus] = useState('Copy');
    const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

    const jsonString = JSON.stringify(data, null, 2);

    useEffect(() => {
        if (copyStatus === 'Copied!') {
            const timer = setTimeout(() => setCopyStatus('Copy'), 2000);
            return () => clearTimeout(timer);
        }
    }, [copyStatus]);

    const handleCopy = () => {
        navigator.clipboard.writeText(jsonString).then(() => {
            setCopyStatus('Copied!');
        }, () => {
            setCopyStatus('Failed!');
        });
    };
    
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
                <h3 className="text-lg font-semibold text-gray-300">JSON Configuration</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 ${
                            copyStatus === 'Copied!' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                    >
                        {copyStatus}
                    </button>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 rounded-md text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                        aria-label={isCollapsed ? "Expand JSON view" : "Collapse JSON view"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                </div>
            </div>
            {!isCollapsed && (
                 <pre className="p-4 text-xs font-mono overflow-auto flex-grow text-gray-200">
                    <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }} />
                </pre>
            )}
        </div>
    );
};

export default JsonDisplay;
