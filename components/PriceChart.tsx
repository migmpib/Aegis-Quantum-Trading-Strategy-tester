import React from 'react';
import type { ProcessedKline, ConfluenceZone, FullReport, OrderbookData } from '../types';

interface PriceChartProps {
    klineData: ProcessedKline[];
    confluenceZones: ConfluenceZone[];
    isLoading: boolean;
    atr: number | null;
    assetInfo: FullReport['asset_info'];
    orderbook: OrderbookData;
}

const formatPrice = (price: number) => {
    if (price < 1) {
        return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    }
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper function to format X-axis labels intelligently
const formatXAxisLabel = (timestamp: number, previousTimestamp: number | null) => {
    const date = new Date(timestamp);
    const prevDate = previousTimestamp ? new Date(previousTimestamp) : null;

    if (!prevDate || date.getDate() !== prevDate.getDate()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};

const PriceChart: React.FC<PriceChartProps> = ({ klineData, confluenceZones, isLoading, atr, assetInfo, orderbook }) => {

    if (isLoading) {
        return (
            <div className="bg-gray-800/60 border border-dashed border-gray-700 rounded-lg p-4 mt-4 animate-pulse h-96 flex justify-center items-center">
                 <span className="text-lg font-semibold text-gray-300">Calculating Confluence Zones & Building Chart...</span>
            </div>
        )
    }

    if (!klineData || klineData.length === 0) {
        return null;
    }

    const margin = { top: 20, right: 90, bottom: 50, left: 120 };
    const width = 1200;
    const height = 600;

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const klinePrices = klineData.flatMap(d => [d.low, d.high]);
    const klineMin = Math.min(...klinePrices);
    const klineMax = Math.max(...klinePrices);

    const viewPadding = atr ? atr * 10 : (klineMax - klineMin) * 0.75;
    const viewMin = klineMin - viewPadding;
    const viewMax = klineMax + viewPadding;

    const relevantZones = confluenceZones.filter(z => z.range[1] >= viewMin && z.range[0] <= viewMax);
    const relevantZonePrices = relevantZones.flatMap(z => [z.range[0], z.range[1]]);
    
    const allRelevantPrices = [...klinePrices, ...relevantZonePrices];
    const minPrice = allRelevantPrices.length > 0 ? Math.min(...allRelevantPrices) : 0;
    const maxPrice = allRelevantPrices.length > 0 ? Math.max(...allRelevantPrices) : 1;
    
    const finalPadding = atr ? atr * 3 : (maxPrice - minPrice) * 0.15; 

    const yMin = minPrice - finalPadding;
    const yMax = maxPrice + finalPadding;
    
    const intervalDuration = klineData.length > 1 ? klineData[1].timestamp - klineData[0].timestamp : 60 * 1000;
    const xMin = klineData[0].timestamp;
    const xMax = klineData[klineData.length - 1].timestamp + (intervalDuration * 5); // Add 5 candles of padding

    const xScale = (timestamp: number) => margin.left + ((timestamp - xMin) / (xMax - xMin)) * chartWidth;
    const yScale = (price: number) => margin.top + chartHeight - ((price - yMin) / (yMax - yMin)) * chartHeight;

    const candleWidth = chartWidth / (klineData.length * 1.5);
    const latestPrice = klineData[klineData.length - 1].close;

    const xAxisTicks = Array.from({ length: 8 }).map((_, i) => xMin + (i * (xMax - xMin)) / 7);

    const zonesForLabeling = relevantZones.slice().sort((a,b) => b.score - a.score).slice(0, 5);
    const labelZoneSet = new Set(zonesForLabeling.map(z => JSON.stringify(z.range)));

    const intervalLabelMap: Record<string, string> = { '5': '5m', '15': '15m', '30': '30m', '60': '1h', '240': '4h', 'D': '1D', 'W': '1W' };
    const intervalLabel = intervalLabelMap[assetInfo.timeframe] || assetInfo.timeframe;

    // --- NEW: BINNING LOGIC FOR ORDER BOOK DEPTH ---
    const binnedBids = new Map<number, number>();
    const binnedAsks = new Map<number, number>();
    const numberOfBins = 150; // Group into 150 price levels for clarity
    const binSize = (yMax - yMin) / numberOfBins;

    // Bin bids
    orderbook?.bids?.forEach(([priceStr, sizeStr]) => {
        const price = parseFloat(priceStr);
        if (price >= yMin && price <= yMax) {
            const binIndex = Math.floor((price - yMin) / binSize);
            const binStartPrice = yMin + binIndex * binSize;
            const currentSize = binnedBids.get(binStartPrice) || 0;
            binnedBids.set(binStartPrice, currentSize + parseFloat(sizeStr));
        }
    });

    // Bin asks
    orderbook?.asks?.forEach(([priceStr, sizeStr]) => {
        const price = parseFloat(priceStr);
        if (price >= yMin && price <= yMax) {
            const binIndex = Math.floor((price - yMin) / binSize);
            const binStartPrice = yMin + binIndex * binSize;
            const currentSize = binnedAsks.get(binStartPrice) || 0;
            binnedAsks.set(binStartPrice, currentSize + parseFloat(sizeStr));
        }
    });

    const allBinnedVolumes = [...binnedBids.values(), ...binnedAsks.values()];
    const maxBinnedVolume = allBinnedVolumes.length > 0 ? Math.max(...allBinnedVolumes) : 1;


    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg shadow-md p-4 mt-4 animate-fade-in">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3 border-b border-gray-600 pb-2">
                {assetInfo.symbol} ({intervalLabel}) - Live Chart & Confluence
            </h3>
            <div className="relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                    <defs>
                        <linearGradient id="supportGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                        </linearGradient>
                        <linearGradient id="resistanceGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#F87171" stopOpacity="0.05" />
                            <stop offset="100%" stopColor="#F87171" stopOpacity="0.2" />
                        </linearGradient>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Y-Axis Grid Lines (NO LABELS) */}
                    {Array.from({ length: 10 }).map((_, i) => {
                        const price = yMin + (i * (yMax - yMin)) / 9;
                        const y = yScale(price);
                        return (
                            <g key={`y-grid-${i}`} className="text-gray-500">
                                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,5" />
                            </g>
                        );
                    })}

                    {/* Confluence Zone Y-Axis Labels on the left */}
                    {relevantZones.map((zone, i) => {
                        const yTop = yScale(zone.range[1]);
                        const yBottom = yScale(zone.range[0]);
                        const isSupport = zone.type === 'support';
                        const textColor = isSupport ? '#6EE7B7' : '#FCA5A5';

                        return (
                            <g key={`zone-label-${i}`} fontSize="10" fill={textColor}>
                                {/* Top of Zone */}
                                <line x1={margin.left - 20} y1={yTop} x2={margin.left} y2={yTop} stroke={textColor} strokeWidth="1" strokeDasharray="2 2" />
                                <text x={margin.left - 25} y={yTop} dy="0.32em" textAnchor="end" className="font-mono">
                                    {formatPrice(zone.range[1])}
                                </text>
                                {/* Bottom of Zone */}
                                <line x1={margin.left - 20} y1={yBottom} x2={margin.left} y2={yBottom} stroke={textColor} strokeWidth="1" strokeDasharray="2 2" />
                                <text x={margin.left - 25} y={yBottom} dy="0.32em" textAnchor="end" className="font-mono">
                                    {formatPrice(zone.range[0])}
                                </text>
                            </g>
                        );
                    })}
                    
                    {/* X-Axis Grid Lines & Labels */}
                    {xAxisTicks.map((tick, i) => {
                        const x = xScale(tick);
                        const prevTick = i > 0 ? xAxisTicks[i - 1] : null;
                        return (
                            <g key={`x-grid-${i}`}>
                                <text x={x} y={height - margin.bottom + 20} textAnchor="middle" fontSize="12" fill="currentColor">
                                    {formatXAxisLabel(tick, prevTick)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Confluence Zones */}
                    {relevantZones.map((zone, i) => {
                         const y1 = yScale(zone.range[0]);
                         const y2 = yScale(zone.range[1]);
                         const isSupport = zone.type === 'support';
                         return (
                             <g key={`zone-${i}`}>
                                 <rect
                                     x={margin.left}
                                     y={y2}
                                     width={chartWidth}
                                     height={y1 - y2}
                                     fill={isSupport ? 'url(#supportGradient)' : 'url(#resistanceGradient)'}
                                     opacity="0.8"
                                 />
                                  {labelZoneSet.has(JSON.stringify(zone.range)) && (
                                    <text
                                        x={width - margin.right + 5}
                                        y={(y1 + y2) / 2}
                                        dy="0.32em"
                                        fontSize="10"
                                        fill={isSupport ? '#6EE7B7' : '#FCA5A5'}
                                        className="font-bold"
                                    >
                                        {`${zone.type.charAt(0).toUpperCase() + zone.type.slice(1)} (${zone.score.toFixed(1)})`}
                                    </text>
                                 )}
                             </g>
                         );
                    })}

                    {/* Candlestick Chart */}
                    {klineData.map(d => {
                        const x = xScale(d.timestamp);
                        // Prevent candle from drawing in the padded area
                        if (x > margin.left + chartWidth) return null;

                        const yOpen = yScale(d.open);
                        const yClose = yScale(d.close);
                        const isGreen = d.close >= d.open;
                        return (
                            <g key={d.timestamp}>
                                <line x1={x} y1={yScale(d.high)} x2={x} y2={yScale(d.low)} stroke={isGreen ? '#10B981' : '#F87171'} strokeWidth="1" />
                                <rect
                                    x={x - candleWidth / 2}
                                    y={isGreen ? yClose : yOpen}
                                    width={candleWidth}
                                    height={Math.abs(yOpen - yClose)}
                                    fill={isGreen ? '#10B981' : '#F87171'}
                                />
                            </g>
                        );
                    })}

                     {/* --- NEW: OVERLAID & MIRRORED ORDER BOOK DEPTH --- */}
                    <g>
                        {/* Bids */}
                        {Array.from(binnedBids.entries()).map(([price, size]) => {
                            const y = yScale(price + binSize); // Start from the bottom of the bin
                            const barHeight = Math.max(1, yScale(price) - yScale(price + binSize)); // Ensure min height of 1px
                            const barWidth = (size / maxBinnedVolume) * chartWidth * 0.4; // Max 40% of chart width

                            return (
                                <rect
                                    key={`bid-depth-${price}`}
                                    x={width - margin.right - barWidth}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    fill="#10B981"
                                    opacity="0.25"
                                    pointerEvents="none"
                                />
                            );
                        })}
                        {/* Asks */}
                        {Array.from(binnedAsks.entries()).map(([price, size]) => {
                            const y = yScale(price + binSize);
                            const barHeight = Math.max(1, yScale(price) - yScale(price + binSize));
                            const barWidth = (size / maxBinnedVolume) * chartWidth * 0.4;

                            return (
                                <rect
                                    key={`ask-depth-${price}`}
                                    x={width - margin.right - barWidth}
                                    y={y}
                                    width={barWidth}
                                    height={barHeight}
                                    fill="#F87171"
                                    opacity="0.25"
                                    pointerEvents="none"
                                />
                            );
                        })}
                    </g>
                    
                    {/* Current Price Line */}
                    <g>
                        <line
                            x1={margin.left}
                            y1={yScale(latestPrice)}
                            x2={width - margin.right}
                            y2={yScale(latestPrice)}
                            stroke="#67e8f9"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            style={{ filter: 'url(#glow)' }}
                        />
                        <rect 
                            x={width - margin.right} 
                            y={yScale(latestPrice) - 12}
                            width={margin.right - 10}
                            height="24"
                            fill="#67e8f9"
                            rx="3"
                        />
                        <text
                            x={width - margin.right + (margin.right - 10) / 2}
                            y={yScale(latestPrice)} 
                            dy="0.35em"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="bold"
                            fill="#083344"
                        >
                            {formatPrice(latestPrice)}
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    );
};

export default PriceChart;