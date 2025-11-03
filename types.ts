// types.ts

// From Bybit API & processing
export type BybitSymbol = {
    symbol: string;
    contractType?: string;
    status: string;
    quoteCoin: string;
    [key: string]: any;
};

export type Kline = [string, string, string, string, string, string, string]; // [startTime, open, high, low, close, volume, turnover]

export type ProcessedKline = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type BybitTrade = {
    side: 'Buy' | 'Sell';
    size: string;
    price: string;
};

export type LiveLiquidation = {
    price: string;
    side: 'Buy' | 'Sell'; // 'Buy' liquidates a short, 'Sell' liquidates a long
    size: string;
    symbol: string;
    updatedTime: string;
};

export type LiveTickerData = {
    lastPrice: string;
    price24hPcnt: string;
    volume24h: string;
    openInterest?: string;
    fundingRate?: string;
    [key: string]: any;
};

export type OrderbookData = {
    error?: string;
    spread_pct: number | null;
    liquidity_imbalance_20_levels: number;
    bid_volume_20_levels: number;
    ask_volume_20_levels: number;
    depth_quality: string;
    bids: [string, string][];
    asks: [string, string][];
};

// Analysis Report Sub-types
export type DerivativesReport = {
    open_interest_value?: number;
    funding_rate?: number;
    long_short_ratio?: number;
    open_interest_delta_4h_pct?: number;
    recent_liquidations_report: {
        status: string;
        dominant_side?: "Longs Liquidated" | "Shorts Liquidated";
        total_liquidated_usd?: number;
        longs_usd?: number;
        shorts_usd?: number;
        longs_count?: number;
        shorts_count?: number;
        largest_liq_usd?: number;
    };
};

export type CorrelationReport = {
    error?: string;
    correlation_coefficient_20p?: number | null;
    correlation_interpretation?: string;
    relative_performance?: string;
    relative_performance_pct_diff?: number;
};

export type KeyLevels = {
    price_action_levels: {
        type: string;
        basis: string;
        support: number | null;
        resistance: number | null;
    };
    volume_profile_levels: {
        type: string;
        basis: string;
        poc_point_of_control: number | null;
        vah_value_area_high: number | null;
        val_value_area_low: number | null;
    };
    fibonacci_pivot_levels: {
        error?: string;
        type?: string;
        basis?: string;
        pp_pivot_point?: number;
        resistances?: { r1: number | null, r2: number | null, r3: number | null };
        supports?: { s1: number | null, s2: number | null, s3: number | null };
    };
    volatility_projection_levels: {
        type: string;
        basis: string;
        anchor_vwap: number | null;
        resistances: { r1: number | null, r2: number | null, r3: number | null };
        supports: { s1: number | null, s2: number | null, s3: number | null };
    };
    trend_following_levels: {
        type: string;
        basis: string;
        ema50: number | null;
        ema200: number | null;
        bollinger_upper: number | null;
        bollinger_lower: number | null;
    };
};

export type ApexExclusiveIndicators = {
    cumulative_volume_delta: { value: number | null; interpretation: string };
    hvn_migration: { status: string; poc_first_half: number | null; poc_second_half: number | null };
    historical_volatility_rank: { rank: number | null; interpretation: string };
};

export type ERIReport = {
    status: string;
    interpretation: string;
    buy_volume: number | null;
    sell_volume: number | null;
    volume_delta: number | null;
    buy_trades: number;
    sell_trades: number;
    trades_delta: number;
    largest_trade_side: 'Buy' | 'Sell' | 'N/A';
    largest_trade_size: number | null;
};

export type MSIReport = {
    dominantState: string;
    probabilities: Record<string, number>;
};

export type MCIReport = {
    type: string;
    pattern: string | null;
    signal: 'Bullish' | 'Bearish' | 'Neutral';
    conviction: number;
    reason: string;
};

// Main Full Report
export type FullReport = {
    asset_info: {
        symbol: string;
        timeframe: string;
        category: string;
        timestamp_utc: string;
    };
    kline_data: ProcessedKline[];
    apex_exclusive_indicators: ApexExclusiveIndicators;
    market_snapshot: {
        close_price: number;
        price_24h_change_pct: number | null;
        volume_24h: number;
        period_change_pct: number | null;
        period_volume: number | null;
        interval_label: string;
    };
    derivatives_analysis: DerivativesReport;
    microstructure_analysis: {
        orderbook_liquidity: OrderbookData;
        taker_volume_analysis_1000_trades: {
            error?: string;
            taker_buy_percentage?: number;
            interpretation?: string;
            trades: BybitTrade[];
        };
    };
    correlation_analysis: CorrelationReport | { correlation_interpretation: string };
    volume_profile_analysis: {
        error?: string;
        point_of_control_poc?: number;
        value_area_high_vah?: number;
        value_area_low_val?: number;
        price_position_vs_va?: string;
    };
    standard_indicators: {
        EMA_50: number | null;
        EMA_200: number | null;
        RSI_14: number | null;
        ADX_14: number | null;
    };
    advanced_analysis: {
        trend_ema: string;
        market_regime_adx: string;
        divergences: {
            rsi_divergence: string;
            obv_divergence: string;
        };
    };
    ichimoku_analysis: {
        error?: string;
        trend?: string;
        momentum?: string;
        future_outlook?: string;
        tenkan_sen?: number;
        kijun_sen?: number;
        senkou_a?: number;
        senkou_b?: number;
    };
    volatility_analysis: {
        bollinger_band_width_pct: number | null;
        keltner_channels_squeeze: string;
    };
    chimera_analysis: {
        regime_filter_crf: string;
        momentum_flow_index_mfi_v: number | null;
        volatility_potential_energy_vpe: number | null;
        vwap_deviation_ratio_vdr: number | null;
        fractal_efficiency_ratio_fer: number | null;
    };
    extra_indicators: {
        ATR_20: number | null;
        PDI_14: number | null;
        MDI_14: number | null;
    };
    key_levels: KeyLevels;
    unification_analysis: {
        market_state_index_msi: MSIReport;
        multi_layer_conviction_index_mci: MCIReport;
        effort_vs_result_index_eri: ERIReport;
    };
    sentiment_analysis: {
        fear_and_greed_index: FearAndGreedIndex | null;
    };
    quantitative_score_analysis: {
        structural_score: number;
        structural_interpretation: string;
        flow_modifier: number;
        flow_interpretation: string;
        composite_score: number;
        interpretation: string;
        active_weighting_matrix: Record<string, Record<string, number>>;
        dominant_state_from_msi: string;
    };
};

// Strategic & Tactical Types
export type FearAndGreedIndex = {
    value: number;
    value_classification: string;
    timestamp: string;
};

export type StrategicContext = {
    dominantBias: "Bullish" | "Bearish" | "Neutral / Ranging";
    confidenceScore: number;
    recommendedStrategyProfile: "Trend Following" | "Mean Reversion" | "Breakout Trading" | "Indeterminate";
    summary: string;
};

export type StrategyProfile = {
    name: "Trend Following" | "Mean Reversion" | "Breakout Trading";
    confirmation_score: number;
    description: string;
    analysis_narrative: string | null;
};

export type StrategyProfilerReport = {
    strategies: StrategyProfile[];
};

export type ImmediateActionScoreReport = {
    score: number;
    direction: 'Long' | 'Short' | 'Neutral';
    riskAppetiteModifier: number;
    reasoning: string;
    interpretation: string | null;
};

export type ConfluenceZone = {
    range: [number, number];
    score: number;
    reasons: string[];
    type: 'support' | 'resistance';
};

// Strategy Builder & Backtester Types
export type Operator = '>' | '<' | '=' | '!=' | 'contains' | 'does not contain';

export type IndicatorName = "Quantitative Score" | "CRF" | "VPE" | "Volatility" | "BTC Correlation" | "HVN Migration" | "Chimera";

export type ContextualFilter = {
    id: string;
    indicator: IndicatorName;
    parameter: string;
    operator: Operator;
    value: number | string;
};

export type LocationalCondition = {
    enabled: boolean;
    type: 'confluence_zone';
    min_score: number;
};

export type ConfluenceZoneExitTarget = 'nearest_edge' | 'middle_of_zone' | 'farthest_edge';

export type RiskManagementExit = {
    type: 'percentage' | 'atr_multiple' | 'risk_reward_ratio' | 'confluence_zone';
    value: number | ConfluenceZoneExitTarget;
};

export type RiskManagement = {
    stop_loss: RiskManagementExit;
    take_profit: RiskManagementExit;
};

export type StrategySide = {
    enabled: boolean;
    locational_condition: LocationalCondition;
    contextual_filters: ContextualFilter[];
    risk_management: RiskManagement;
};

export type StrategyConfig = {
    strategyName: string;
    asset: {
        symbol: string;
        timeframe: string;
    };
    long_strategy: StrategySide;
    short_strategy: StrategySide;
};

export type BacktestSettings = {
    initialCapital: number;
    positionSizing: {
        type: 'percentage_of_equity' | 'fixed_amount';
        value: number;
    };
    fees: {
        makerPercent: number;
        takerPercent: number;
    };
    slippagePercent: number;
};

export type TradeLogEntry = {
    id: string;
    side: 'Long' | 'Short';
    entryTimestamp: number;
    entryPrice: number;
    exitTimestamp: number;
    exitPrice: number;
    profit: number;
    profitPct: number;
};

export type BacktestResults = {
    netProfit: number;
    netProfitPct: number;
    profitFactor: number | null;
    winRate: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    totalTrades: number;
    avgWin: number | null;
    avgLoss: number | null;
    tradeLog: TradeLogEntry[];
};

export type EnrichedKline = ProcessedKline & {
    indicators: Record<string, any>;
};