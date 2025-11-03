





import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Removed unused 'LiquidityCluster' import.
import type { BybitSymbol, FullReport, StrategicContext, StrategyProfilerReport, LiveLiquidation, FearAndGreedIndex, ImmediateActionScoreReport, ConfluenceZone, ProcessedKline, LiveTickerData, BybitTrade } from './types';
// FIX: Removed unused 'findLiquidityClusters' import.
import { fetchSymbols, generateFullReport, recalculateReportWithLiveData } from './services/analysisService';
import { getStrategicContext } from './services/strategicContextService';
import { profileStrategies } from './services/strategyProfilerService';
import { calculateImmediateActionScore } from './services/immediateActionService';
import { findLevelConfluence } from './services/confluenceService';

import Selector from './components/Selector';
import ReportDisplay from './components/ReportDisplay';
import Spinner from './components/Spinner';
import StrategicContextCard from './components/StrategicContextCard';
import StrategyProfilerCard from './components/StrategyProfilerCard';
import StrategyBuilder from './components/StrategyBuilder';

// ** THE FIX **: A curated list of major perpetuals known to have a liquidations stream.
// BTCUSDT is excluded as the v5 stream returns a "handler not found" error for the `liquidations.BTCUSDT` topic.
// This prevents subscription errors for unavailable streams.
const MAJOR_PERPETUALS = new Set([
    'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', '1000PEPEUSDT',
    'ADAUSDT', 'MATICUSDT', 'DOTUSDT', 'BNBUSDT', 'AVAXUSDT',
    'LTCUSDT', 'LINKUSDT', 'UNIUSDT', 'TRXUSDT', 'ATOMUSDT', 'ETCUSDT',
    'BCHUSDT', 'FILUSDT', 'APTUSDT', 'NEARUSDT', 'OPUSDT', 'LDOUSDT'
]);

const App: React.FC = () => {
    // State management
    const [symbols, setSymbols] = useState<BybitSymbol[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('linear');
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
    const [selectedInterval, setSelectedInterval] = useState('60');
    const [activeTab, setActiveTab] = useState('analysis');
    const activeTabRef = useRef(activeTab);

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isContextLoading, setIsContextLoading] = useState(false);
    const [isIasLoading, setIsIasLoading] = useState(false);
    const [isConfluenceLoading, setIsConfluenceLoading] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const isRecalculatingRef = useRef(false);

    // Data states
    const [fullReport, setFullReport] = useState<FullReport | null>(null);
    const [allReports, setAllReports] = useState<FullReport[]>([]);
    const [strategicContext, setStrategicContext] = useState<StrategicContext | null>(null);
    const [strategyProfile, setStrategyProfile] = useState<StrategyProfilerReport | null>(null);
    const [iasReport, setIasReport] = useState<ImmediateActionScoreReport | null>(null);
    const [confluenceZones, setConfluenceZones] = useState<ConfluenceZone[]>([]);
    
    // LIVE DATA STATES
    const [liveLiquidations, setLiveLiquidations] = useState<LiveLiquidation[]>([]);
    const [liveKlineData, setLiveKlineData] = useState<ProcessedKline[]>([]);
    const [liveBtcKlineData, setLiveBtcKlineData] = useState<ProcessedKline[]>([]);
    const [liveTickerData, setLiveTickerData] = useState<LiveTickerData | null>(null);
    const [liveTrades, setLiveTrades] = useState<BybitTrade[]>([]);
    
    const [error, setError] = useState<string | null>(null);
    const ws = useRef<WebSocket | null>(null);
    // FIX: Changed timer ref types to `number | null` to align with browser APIs (e.g., window.setInterval) and prevent type conflicts.
    const pingInterval = useRef<number | null>(null);
    const reconnectTimeout = useRef<number | null>(null);
    const isCancelledRef = useRef(false);
    const prevDayKlineRef = useRef<any>(null);
    const fearAndGreedIndexRef = useRef<FearAndGreedIndex | null>(null);
    const initialReportGenerated = useRef(false);

    // Ref to hold the live order book state to avoid re-renders on every delta
    const orderbookRef = useRef<{ bids: Map<string, string>, asks: Map<string, string> }>({
        bids: new Map(),
        asks: new Map()
    });

    useEffect(() => {
        activeTabRef.current = activeTab;
    }, [activeTab]);

    // Fetch symbols on category change
    useEffect(() => {
        const loadSymbols = async () => {
            try {
                const fetchedSymbols = await fetchSymbols(selectedCategory);
                setSymbols(fetchedSymbols);
                if (fetchedSymbols.length > 0 && !fetchedSymbols.some(s => s.symbol === selectedSymbol)) {
                    setSelectedSymbol(fetchedSymbols.find(s => s.symbol === 'BTCUSDT') ? 'BTCUSDT' : fetchedSymbols[0].symbol);
                }
            } catch (err) {
                console.error("Failed to fetch symbols:", err);
                setError("Could not load symbols from Bybit API.");
            }
        };
        loadSymbols();
    }, [selectedCategory]);

    // WebSocket for live data with auto-reconnection
    useEffect(() => {
        // Do not connect WebSocket if on the strategy builder tab
        if (activeTab === 'strategy' || !selectedSymbol || !selectedCategory) {
            // If there's an existing connection, close it
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close(1000, "Switched tabs");
                ws.current = null;
                 if (pingInterval.current) window.clearInterval(pingInterval.current);
            }
            return;
        }

        let isMounted = true;
        const selectedSymbolInfo = symbols.find(s => s.symbol === selectedSymbol);

        const connect = () => {
            if (!isMounted) return;
            // Clear previous data on new connection
            setLiveLiquidations([]);
            setLiveTickerData(null);
            setLiveTrades([]);

            orderbookRef.current = { bids: new Map(), asks: new Map() };
            const wsUrl = `wss://stream.bybit.com/v5/public/${selectedCategory}`;
            const newWs = new WebSocket(wsUrl);
            ws.current = newWs;

            newWs.onopen = () => {
                if (!isMounted) return;
                console.log("WebSocket connected. Subscribing to topics...");
                setError(null);

                const topics = new Set([
                    `kline.${selectedInterval}.${selectedSymbol}`,
                    `orderbook.50.${selectedSymbol}`,
                    `tickers.${selectedSymbol}`,
                    `publicTrade.${selectedSymbol}`
                ]);

                // ** THE FIX **: Subscribe to liquidations ONLY for known major perpetuals.
                // This prevents errors on less common symbols where the stream is unavailable.
                if (selectedSymbolInfo?.contractType?.includes('Perpetual') && MAJOR_PERPETUALS.has(selectedSymbol)) {
                    topics.add(`liquidations.${selectedSymbol}`);
                }
                
                // Also subscribe to BTCUSDT klines for live correlation analysis
                if (selectedSymbol !== 'BTCUSDT') {
                    topics.add(`kline.${selectedInterval}.BTCUSDT`);
                }

                topics.forEach(topic => {
                    newWs.send(JSON.stringify({
                        op: 'subscribe',
                        args: [topic]
                    }));
                });

                // Fix: Use window.clearInterval to avoid type conflicts with Node.js types.
                if (pingInterval.current) window.clearInterval(pingInterval.current);
                pingInterval.current = window.setInterval(() => {
                    if (newWs.readyState === WebSocket.OPEN) {
                        newWs.send(JSON.stringify({ op: 'ping' }));
                    }
                }, 20000);
            };

            newWs.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data);
                    if (message.op === 'subscribe') {
                        if (message.success) {
                            console.log(`Successfully subscribed to topic: ${message.args?.[0] || 'Unknown'}`);
                        } else {
                             // The error message from Bybit contains the problematic topic
                            const failedTopic = message.ret_msg?.split('topic:')[1] || message.args?.[0] || 'Unknown';
                            console.warn(`Subscription failed for topic '${failedTopic}':`, message.ret_msg);
                        }
                        return;
                    }
                    if (message.op === 'pong' || message.ret_msg === 'pong') return;

                    const topic = message.topic || '';
                    if (!topic) return;

                    if (topic.startsWith('liquidations') && message.data) {
                        setLiveLiquidations(prev => [...prev, ...message.data].slice(-50));
                    } else if (topic.startsWith('tickers') && message.data) {
                        setLiveTickerData(prevData => ({
                           ...(prevData || {}),
                           ...message.data,
                        }));
                    } else if (topic.startsWith('publicTrade') && Array.isArray(message.data)) {
                        const newTrades: BybitTrade[] = message.data.map((t: any) => ({
                            side: t.S,
                            size: t.v,
                            price: t.p,
                        }));
                        setLiveTrades(prev => [...prev, ...newTrades].slice(-200)); // Keep last 200 trades
                    } else if (topic.startsWith('kline') && message.data?.length > 0) {
                        const kline = message.data[0];
                        const newKline: ProcessedKline = {
                            timestamp: parseInt(kline.start), open: parseFloat(kline.open), high: parseFloat(kline.high),
                            low: parseFloat(kline.low), close: parseFloat(kline.close), volume: parseFloat(kline.volume),
                        };
                        
                        const stateUpdater = topic.includes('BTCUSDT') ? setLiveBtcKlineData : setLiveKlineData;

                        stateUpdater(prevData => {
                            if (prevData.length === 0) return [newKline]; // Handle initial population
                            const lastCandle = prevData[prevData.length - 1];
                            if (lastCandle && lastCandle.timestamp === newKline.timestamp) {
                                const updatedData = [...prevData];
                                updatedData[updatedData.length - 1] = newKline;
                                return updatedData;
                            } else {
                                return [...prevData.slice(1), newKline];
                            }
                        });
                    } else if (topic.startsWith('orderbook') && message.data) {
                        // ** THE FIX **: The sole responsibility of this block is to keep the orderbookRef up-to-date.
                        // All calculations are now handled centrally in the recalculation loop.
                        const { b: bidsDelta, a: asksDelta } = message.data;
                        if (message.type === 'snapshot') {
                            orderbookRef.current.bids.clear(); orderbookRef.current.asks.clear();
                            bidsDelta?.forEach(([price, size]: [string, string]) => orderbookRef.current.bids.set(price, size));
                            asksDelta?.forEach(([price, size]: [string, string]) => orderbookRef.current.asks.set(price, size));
                        } else if (message.type === 'delta') {
                            bidsDelta?.forEach(([price, size]: [string, string]) => {
                                if (size === '0') orderbookRef.current.bids.delete(price); else orderbookRef.current.bids.set(price, size);
                            });
                            asksDelta?.forEach(([price, size]: [string, string]) => {
                                if (size === '0') orderbookRef.current.asks.delete(price); else orderbookRef.current.asks.set(price, size);
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse WebSocket message:", e);
                }
            };

            newWs.onerror = (event) => { if (isMounted) console.error("WebSocket error event triggered.", event); };
            newWs.onclose = (event: CloseEvent) => {
                if (!isMounted) return;
                // Fix: Use window.clearInterval to avoid type conflicts with Node.js types.
                if (pingInterval.current) window.clearInterval(pingInterval.current);
                if (event.code !== 1000) {
                    setError(`Live connection lost (Code: ${event.code}). Attempting to reconnect in 5s...`);
                    // Fix: Use window.clearTimeout to avoid type conflicts with Node.js types.
                    if (reconnectTimeout.current) window.clearTimeout(reconnectTimeout.current);
                    reconnectTimeout.current = window.setTimeout(connect, 5000);
                }
            };
        };
        
        connect();

        return () => {
            isMounted = false;
            // Fix: Use window.clearTimeout to avoid type conflicts with Node.js types.
            if (reconnectTimeout.current) window.clearTimeout(reconnectTimeout.current);
            // Fix: Use window.clearInterval to avoid type conflicts with Node.js types.
            if (pingInterval.current) window.clearInterval(pingInterval.current);
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.close(1000, "React component cleanup");
            }
            ws.current = null;
        };
    }, [selectedSymbol, selectedCategory, selectedInterval, symbols, activeTab]);

    // EFFECT FOR HIGH-FREQUENCY LIVE RECALCULATION
    const recalculate = useCallback(async () => {
        if (!fullReport || liveKlineData.length < 1000 || isRecalculatingRef.current || isCancelledRef.current) {
            return;
        }
        isRecalculatingRef.current = true;
        setIsRecalculating(true);
        try {
            const btcKlines = selectedSymbol === 'BTCUSDT' ? liveKlineData : (liveBtcKlineData.length > 0 ? liveBtcKlineData : null);
            if (!btcKlines) {
                console.warn("Waiting for BTC kline data for live correlation...");
                setIsRecalculating(false);
                isRecalculatingRef.current = false;
                return;
            }
            const updatedReport = await recalculateReportWithLiveData(
                fullReport,
                liveKlineData,
                btcKlines,
                prevDayKlineRef.current,
                liveTickerData,
                liveLiquidations,
                liveTrades,
                [...orderbookRef.current.bids.entries()],
                [...orderbookRef.current.asks.entries()],
                fearAndGreedIndexRef.current
            );
            
            if (activeTabRef.current === 'analysis') {
                setFullReport(updatedReport);
            }

        } catch (error) {
            console.error("Failed during live recalculation:", error);
        } finally {
            setIsRecalculating(false);
            isRecalculatingRef.current = false;
        }
    }, [fullReport, liveKlineData, liveBtcKlineData, liveTickerData, liveLiquidations, liveTrades, selectedSymbol]);

    const savedRecalculateCallback = useRef<() => Promise<void>>();
    useEffect(() => {
        savedRecalculateCallback.current = recalculate;
    }, [recalculate]);

    // FIX: Refactored interval management to be more robust and prevent potential runtime errors.
    // This pattern ensures that `clearInterval` is only called with a valid ID returned from `setInterval`,
    // avoiding issues with mutable variables and stale closures.
    useEffect(() => {
        const hasReport = fullReport !== null;
        // Only set up the interval if there is a report to update and we are on the analysis tab.
        if (!hasReport || activeTab !== 'analysis') {
            return; // No interval needed, so return undefined (no cleanup).
        }

        const intervalId = window.setInterval(() => {
            // Use the saved callback ref to call the latest `recalculate` function.
            if (savedRecalculateCallback.current) {
                savedRecalculateCallback.current();
            }
        }, 3000);
        
        // Return a cleanup function that is guaranteed to have a valid intervalId.
        return () => {
            window.clearInterval(intervalId);
        };
    // The dependency on the `fullReport` object caused a dependency cycle, as the interval's callback updated the report.
    // Using `fullReport !== null` breaks this cycle by only re-running the effect when the report's existence changes, not its content.
    }, [fullReport !== null, activeTab]);


    const handleStop = useCallback(() => {
        isCancelledRef.current = true;
        setIsLoading(false);
        setIsContextLoading(false);
        setIsIasLoading(false);
        setIsConfluenceLoading(false);
        setError('Analysis cancelled by user.');
    }, []);

    const handleGenerateReport = useCallback(async () => {
        isCancelledRef.current = false;
        setIsLoading(true);
        setIsContextLoading(true);
        setIsIasLoading(true);
        setIsConfluenceLoading(true);
        setError(null);
        setFullReport(null);
        setAllReports([]);
        setStrategicContext(null);
        setStrategyProfile(null);
        setIasReport(null);
        setConfluenceZones([]);
        // Live data is cleared by the WebSocket useEffect on re-connect
        
        try {
            const { report, htfReports, allReports, prevDayKlineResult, fearAndGreedResult } = await generateFullReport(selectedCategory, selectedSymbol, selectedInterval);
            if (isCancelledRef.current) return;
            
            prevDayKlineRef.current = prevDayKlineResult;
            fearAndGreedIndexRef.current = fearAndGreedResult;

            // Pre-populate live data states with initial historical data
            setFullReport(report);
            setAllReports(allReports);
            setLiveKlineData(report.kline_data);
            if (selectedSymbol === 'BTCUSDT') {
                setLiveBtcKlineData(report.kline_data);
            } else {
                // Fetch initial BTC data if not already the selected symbol
                const btcReport = allReports.find(r => r.asset_info.symbol === 'BTCUSDT' && r.asset_info.timeframe === selectedInterval);
                if (btcReport) {
                    setLiveBtcKlineData(btcReport.kline_data);
                }
            }
            setLiveTrades(report.microstructure_analysis.taker_volume_analysis_1000_trades.trades || []);
            setIsLoading(false);

            // FIX: Passed `htfReports` and `fearAndGreedResult` to `getStrategicContext` to resolve the missing arguments error.
            const context = getStrategicContext(htfReports, fearAndGreedResult);
            setStrategicContext(context);
            setIsContextLoading(false);
            if (isCancelledRef.current) return;

            // FIX: The `profileStrategies` function was called with a missing `selectedInterval` argument. This has been corrected.
            const initialProfiles = profileStrategies(allReports, context, selectedInterval);
            setStrategyProfile(initialProfiles);
            
            // FIX: Corrected the call to `calculateImmediateActionScore` which was missing arguments.
            // The function was refactored to derive the strategic context internally, but the call site was not updated to pass the necessary reports.
            const calculatedIas = calculateImmediateActionScore(report, allReports, fearAndGreedResult);
            setIasReport({ ...calculatedIas, interpretation: null });
            setIsIasLoading(false);
            if (isCancelledRef.current) return;

            const zones = findLevelConfluence(allReports, report.market_snapshot.close_price);
            setConfluenceZones(zones);
            setIsConfluenceLoading(false);

        } catch (err: any) {
            console.error("Failed to generate full report:", err);
            setError(`Error: ${err.message}`);
            setIsLoading(false);
            setIsContextLoading(false);
            setIsIasLoading(false);
            setIsConfluenceLoading(false);
        }
    }, [selectedCategory, selectedSymbol, selectedInterval]);
    
    // Auto-generate report on first load
    useEffect(() => {
        // FIX: The auto-generation was firing before symbols were fetched, causing potential race conditions.
        // This ensures the report is generated only once after the initial symbol list is available.
        if (symbols.length > 0 && !initialReportGenerated.current) {
            initialReportGenerated.current = true;
            void handleGenerateReport();
        }
    }, [symbols, handleGenerateReport]);

    return (
        <div className="min-h-screen container mx-auto p-4 font-sans">
            <header className="mb-4">
                <h1 className="text-3xl font-bold text-gray-200">Aegis Quantitative Foundation</h1>
                <p className="text-gray-400">High-frequency tactical analysis engine for cryptocurrency markets.</p>
            </header>

            <Selector
                symbols={symbols}
                selectedSymbol={selectedSymbol}
                setSelectedSymbol={setSelectedSymbol}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectedInterval={selectedInterval}
                setSelectedInterval={setSelectedInterval}
                onGenerate={handleGenerateReport}
                onStop={handleStop}
                isLoading={isLoading}
            />
            
             {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative my-4" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            
            {/* TABS */}
            <div className="my-4">
                <div className="border-b border-gray-700">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`${activeTab === 'analysis' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            Tactical Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('strategy')}
                            className={`${activeTab === 'strategy' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            Strategy Builder & Backtest
                        </button>
                    </nav>
                </div>
            </div>

            {isLoading && <Spinner />}
            
            <main>
                {activeTab === 'analysis' && fullReport && (
                    <>
                        <StrategicContextCard isLoading={isContextLoading} context={strategicContext} />
                        <StrategyProfilerCard isLoading={isContextLoading} report={strategyProfile} context={strategicContext}/>
                        <ReportDisplay
                            report={fullReport}
                            iasReport={iasReport}
                            isIasLoading={isIasLoading}
                            confluenceZones={confluenceZones}
                            isConfluenceLoading={isConfluenceLoading}
                            liveKlineData={liveKlineData}
                            liveLiquidations={liveLiquidations}
                        />
                    </>
                )}
                {activeTab === 'strategy' && fullReport && (
                    <StrategyBuilder 
                        assetInfo={fullReport.asset_info} 
                        fullReport={fullReport}
                        allReports={allReports}
                        liveBtcKlineData={liveBtcKlineData}
                    />
                )}
            </main>
        </div>
    );
};

export default App;