import { describe, expect, test } from "bun:test";
import { calculateMCI } from "./taUtils";
import type { ProcessedKline, ERIReport } from "../types";

// Helper to create a single kline
const createKline = (close: number, volume: number = 100, timestamp: number = Date.now()): ProcessedKline => ({
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume
});

// Helper to create a series of klines
const createKlineSeries = (prices: number[]): ProcessedKline[] => {
    return prices.map((p, i) => createKline(p, 100, Date.now() + i * 60000));
};

// Helper to create ERI Report
const createERIReport = (overrides?: Partial<ERIReport>): ERIReport => ({
    status: "OK",
    interpretation: "Neutral",
    buy_volume: 50,
    sell_volume: 50,
    volume_delta: 0,
    buy_trades: 10,
    sell_trades: 10,
    trades_delta: 0,
    largest_trade_side: "N/A",
    largest_trade_size: 0,
    ...overrides
});

describe("calculateMCI", () => {
    test("Insufficient Data", () => {
        const eri = createERIReport();
        // Pass empty array
        const result = calculateMCI([], [], null, null, null, null, eri, '60');
        expect(result.type).toBe("Indeterminate");
        expect(result.reason).toContain("Insufficient data");
    });

    test("Short Squeeze Pattern", () => {
        // Price change > 4% in last hour
        // For '60' timeframe, it compares last close with close 1 candle ago.
        const prices = [100, 105]; // 5% increase
        const df = createKlineSeries(prices);
        const ema20 = [100, 102];
        const eri = createERIReport();

        const result = calculateMCI(
            df,
            ema20,
            50, // taker_buy_percentage
            -0.01, // funding_rate < 0
            0.7, // long_short_ratio < 0.8
            3, // open_interest_delta_4h_pct > 2
            eri,
            '60'
        );

        expect(result.type).toBe("Pattern");
        expect(result.pattern).toBe("Short Squeeze");
        expect(result.signal).toBe("Bullish");
        expect(result.conviction).toBe(90);
    });

    test("Long Squeeze Pattern", () => {
        // Price change < -4% in last hour
        const prices = [100, 95]; // 5% decrease
        const df = createKlineSeries(prices);
        const ema20 = [100, 98];
        const eri = createERIReport();

        const result = calculateMCI(
            df,
            ema20,
            50, // taker_buy_percentage
            0.01, // funding_rate > 0
            1.3, // long_short_ratio > 1.2
            3, // open_interest_delta_4h_pct > 2
            eri,
            '60'
        );

        expect(result.type).toBe("Pattern");
        expect(result.pattern).toBe("Long Squeeze");
        expect(result.signal).toBe("Bearish");
        expect(result.conviction).toBe(90);
    });

    test("Hidden Buying Pattern", () => {
        // Price change < 1.5% (abs)
        const prices = [100, 101]; // 1% increase
        const df = createKlineSeries(prices);
        const ema20 = [100, 100.5];
        const eri = createERIReport({ interpretation: "Bullish Divergence detected" });

        const result = calculateMCI(
            df,
            ema20,
            50,
            0,
            1,
            0,
            eri,
            '60'
        );

        expect(result.type).toBe("Pattern");
        expect(result.pattern).toBe("Hidden Buying");
        expect(result.signal).toBe("Bullish");
        expect(result.conviction).toBe(85);
    });

    test("Basic Conviction - Bullish Trend", () => {
        // Bullish trend: last_close > ema20
        const prices = [100, 102];
        const df = createKlineSeries(prices);
        const ema20 = [100, 101]; // last close (102) > ema20 (101)
        const eri = createERIReport({ volume_delta: 10 }); // Positive volume delta (+10 points)

        // Base conviction 50
        // +10 (taker > 52)
        // +5 (funding > 0)
        // +5 (long/short > 1)
        // +10 (volume delta > 0)
        // Total = 50 + 10 + 5 + 5 + 10 = 80

        const result = calculateMCI(
            df,
            ema20,
            55, // taker > 52
            0.01, // funding > 0
            1.1, // l/s > 1
            0,
            eri,
            '60'
        );

        expect(result.type).toBe("Momentum");
        expect(result.signal).toBe("Bullish");
        expect(result.conviction).toBe(80);
    });

    test("Basic Conviction - Bearish Trend", () => {
        // Bearish trend: last_close <= ema20
        const prices = [100, 98];
        const df = createKlineSeries(prices);
        const ema20 = [100, 99]; // last close (98) <= ema20 (99)
        const eri = createERIReport({ volume_delta: -10 }); // Negative volume delta (+10 points)

        // Base conviction 50
        // +10 (taker < 48)
        // +5 (funding < 0)
        // +5 (long/short < 1)
        // +10 (volume delta < 0)
        // Total = 50 + 10 + 5 + 5 + 10 = 80

        const result = calculateMCI(
            df,
            ema20,
            45, // taker < 48
            -0.01, // funding < 0
            0.9, // l/s < 1
            0,
            eri,
            '60'
        );

        expect(result.type).toBe("Momentum");
        expect(result.signal).toBe("Bearish");
        expect(result.conviction).toBe(80);
    });
});
