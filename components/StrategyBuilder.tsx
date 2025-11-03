import React, { useState, useEffect } from 'react';
import type { StrategyConfig, FullReport, BacktestSettings, BacktestResults, ProcessedKline } from '../types';
import StrategySideEditor from './StrategySideEditor';
import JsonDisplay from './JsonDisplay';
import LogsDisplay from './LogsDisplay'; // New Import
import BacktestSettingsModal from './BacktestSettingsModal';
import BacktestProgress from './BacktestProgress';
import BacktestResultsDisplay from './BacktestResultsDisplay';
import { runBacktest } from '../services/backtesterService';


const initialStrategyConfig: Omit<StrategyConfig, 'asset'> = {
    strategyName: 'Default Backtestable Strategy',
    long_strategy: {
        enabled: true,
        locational_condition: {
            enabled: false,
            type: 'confluence_zone',
            min_score: 5.0,
        },
        contextual_filters: [
            {
                id: `long-quant-${Date.now()}`,
                indicator: 'Quantitative Score',
                parameter: 'composite_score',
                operator: '>',
                value: 0.2,
            },
            {
                id: `long-crf-${Date.now() + 1}`,
                indicator: 'CRF',
                parameter: 'regime',
                operator: 'contains',
                value: 'Bullish Trend',
            }
        ],
        risk_management: {
            stop_loss: {
                type: 'atr_multiple',
                value: 1.5,
            },
            take_profit: {
                type: 'risk_reward_ratio',
                value: 2.0,
            }
        }
    },
    short_strategy: {
        enabled: true,
        locational_condition: {
            enabled: false,
            type: 'confluence_zone',
            min_score: 5.0,
        },
        contextual_filters: [
            {
                id: `short-quant-${Date.now()}`,
                indicator: 'Quantitative Score',
                parameter: 'composite_score',
                operator: '<',
                value: -0.2,
            },
            {
                id: `short-crf-${Date.now() + 1}`,
                indicator: 'CRF',
                parameter: 'regime',
                operator: 'contains',
                value: 'Bearish Trend',
            }
        ],
        risk_management: {
            stop_loss: {
                type: 'atr_multiple',
                value: 1.5,
            },
            take_profit: {
                type: 'risk_reward_ratio',
                value: 2.0,
            }
        }
    },
};

interface StrategyBuilderProps {
    assetInfo: FullReport['asset_info'];
    fullReport: FullReport;
    allReports: FullReport[];
    liveBtcKlineData: ProcessedKline[];
}

const StrategyBuilder: React.FC<StrategyBuilderProps> = ({ assetInfo, fullReport, allReports, liveBtcKlineData }) => {
    const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>(() => {
        const config = JSON.parse(JSON.stringify(initialStrategyConfig));
        config.asset = {
            symbol: assetInfo.symbol,
            timeframe: assetInfo.timeframe
        };
        return config;
    });

    // Backtesting & Logging State
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [backtestProgress, setBacktestProgress] = useState(0);
    const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
    const [logs, setLogs] = useState<Record<string, any>>({});


    useEffect(() => {
        setStrategyConfig(prevConfig => ({
            ...prevConfig,
            asset: {
                symbol: assetInfo.symbol,
                timeframe: assetInfo.timeframe
            }
        }));
    }, [assetInfo]);

    const handleStartBacktest = async (settings: BacktestSettings) => {
        console.log("Starting backtest with settings:", settings);
        setShowSettingsModal(false);
        setIsBacktesting(true);
        setBacktestResults(null);
        setBacktestProgress(0);
        setLogs({}); // Clear previous logs

        try {
            const results = await runBacktest(
                strategyConfig,
                fullReport,
                settings,
                (progress) => setBacktestProgress(progress),
                liveBtcKlineData,
                isLoggingEnabled, // Pass logging flag
                (logName, data) => { // Pass logging callback
                    setLogs(prevLogs => ({ ...prevLogs, [logName]: data }));
                },
                allReports
            );
            setBacktestResults(results);
        } catch (error) {
            console.error("Backtest failed:", error);
        } finally {
            setIsBacktesting(false);
        }
    };

    const handleCancelBacktest = () => {
        setIsBacktesting(false);
        setBacktestProgress(0);
        console.log("Backtest cancelled by user.");
    };

    const isRunButtonDisabled = !strategyConfig.long_strategy.enabled && !strategyConfig.short_strategy.enabled;

    return (
        <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-200">Strategy Builder</h2>
                <button
                    onClick={() => setShowSettingsModal(true)}
                    disabled={isRunButtonDisabled || isBacktesting}
                    className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-bold py-2 px-6 rounded-md transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Start Backtest
                </button>
            </div>
            
            {isBacktesting && (
                <BacktestProgress 
                    progress={backtestProgress} 
                    onCancel={handleCancelBacktest} 
                />
            )}

            {backtestResults && (
                 <BacktestResultsDisplay results={backtestResults} />
            )}

            {showSettingsModal && (
                <BacktestSettingsModal
                    onClose={() => setShowSettingsModal(false)}
                    onStart={handleStartBacktest}
                />
            )}
            
            <div className={`mt-6 transition-opacity grid grid-cols-1 lg:grid-cols-2 gap-6 ${isBacktesting ? 'opacity-30 pointer-events-none' : ''}`}>
                {/* Row 1: Strategy Editors */}
                <StrategySideEditor
                    side="long"
                    config={strategyConfig.long_strategy}
                    onUpdate={(updatedSide) => {
                        setStrategyConfig(prev => ({ ...prev, long_strategy: updatedSide }));
                    }}
                />
                <StrategySideEditor
                    side="short"
                    config={strategyConfig.short_strategy}
                    onUpdate={(updatedSide) => {
                        setStrategyConfig(prev => ({ ...prev, short_strategy: updatedSide }));
                    }}
                />
                
                {/* Row 2: JSON and Logs */}
                <JsonDisplay data={strategyConfig} />
                <LogsDisplay 
                    logs={logs}
                    isEnabled={isLoggingEnabled}
                    setIsEnabled={setIsLoggingEnabled}
                />
            </div>
        </div>
    );
};

export default StrategyBuilder;