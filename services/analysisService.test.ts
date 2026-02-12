import { expect, test, describe } from "bun:test";
import {
    calculateADX, calculateBB, calculateEMA, calculateRSI, calculate_vwap_deviation_ratio,
    calculate_fractal_efficiency_ratio, calculate_mfi_v, calculate_vpe, calculateOBV,
    calculateIchimoku, calculateKC, calculateATR
} from './taUtils';
import type { ProcessedKline } from '../types';
import { calculateStandardIndicators } from './analysisService';

// Mock data
const generateMockData = (length: number): ProcessedKline[] => {
    const data: ProcessedKline[] = [];
    let price = 10000;
    for (let i = 0; i < length; i++) {
        price = price + (Math.random() - 0.5) * 100;
        data.push({
            timestamp: Date.now() + i * 60000,
            open: price,
            high: price + 10,
            low: price - 10,
            close: price + (Math.random() - 0.5) * 5,
            volume: 100 + Math.random() * 50
        });
    }
    return data;
};

describe("Analysis Service Refactoring", () => {
    test("Refactored logic matches original logic", () => {
        const df = generateMockData(300);

        // Original Logic (copied from analysisService.ts)
        const closes = df.map(d => d.close);
        const highs = df.map(d => d.high);
        const lows = df.map(d => d.low);
        const volumes = df.map(d => d.volume);

        const ema20 = calculateEMA(closes, 20);
        const ema50 = calculateEMA(closes, 50);
        const ema200 = calculateEMA(closes, 200);
        const rsi14 = calculateRSI(closes, 14);
        const bb20 = calculateBB(closes, 20, 2);
        const adx14 = calculateADX(highs, lows, closes, 14);
        const obv = calculateOBV(closes, volumes);
        const ichimoku = calculateIchimoku(highs, lows, { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 });
        const kc20 = calculateKC(highs, lows, closes, 20, 2);
        const vdr = calculate_vwap_deviation_ratio(df, 14);
        const fer = calculate_fractal_efficiency_ratio(df, 14);
        const mfi_v = calculate_mfi_v(df, rsi14, adx14);
        const vpe = calculate_vpe(df, bb20.bandwidth, adx14);
        const atr20 = calculateATR(highs, lows, closes, 20);

        const latest = {
            close: df.length > 0 ? df[df.length - 1].close : 0,
            EMA_50: ema50[ema50.length - 1],
            EMA_200: ema200[ema200.length - 1],
            RSI_14: rsi14[rsi14.length - 1],
            ADX_14: adx14.length > 0 ? adx14[adx14.length - 1]?.adx : null,
            BBB_20_2: bb20.bandwidth[bb20.bandwidth.length - 1],
            BBU_20_2: bb20.upper[bb20.upper.length-1],
            BBL_20_2: bb20.lower[bb20.lower.length-1],
            FER: fer[fer.length - 1],
            Ichimoku_ISA: ichimoku.senkouA.length > 0 ? ichimoku.senkouA[ichimoku.senkouA.length - 1] : null,
            Ichimoku_ISB: ichimoku.senkouB.length > 0 ? ichimoku.senkouB[ichimoku.senkouB.length - 1] : null,
            Ichimoku_Tenkan: ichimoku.tenkan.length > 0 ? ichimoku.tenkan[ichimoku.tenkan.length-1] : null,
            Ichimoku_Kijun: ichimoku.kijun.length > 0 ? ichimoku.kijun[ichimoku.kijun.length-1] : null,
            KCLe_20_2: kc20.lower[kc20.lower.length - 1],
            KCUe_20_2: kc20.upper[kc20.upper.length - 1],
        };

        const originalResults = {
             ema20, ema50, ema200, rsi14, bb20, adx14, obv, ichimoku, kc20, vdr, fer, mfi_v, vpe, atr20, latest
        };

        // Call the new function
        const newResults = calculateStandardIndicators(df);

        // Assertions
        expect(newResults.ema20).toEqual(originalResults.ema20);
        expect(newResults.ema50).toEqual(originalResults.ema50);
        expect(newResults.ema200).toEqual(originalResults.ema200);
        expect(newResults.rsi14).toEqual(originalResults.rsi14);
        expect(newResults.bb20).toEqual(originalResults.bb20);
        expect(newResults.adx14).toEqual(originalResults.adx14);
        expect(newResults.obv).toEqual(originalResults.obv);
        expect(newResults.ichimoku).toEqual(originalResults.ichimoku);
        expect(newResults.kc20).toEqual(originalResults.kc20);
        expect(newResults.vdr).toEqual(originalResults.vdr);
        expect(newResults.fer).toEqual(originalResults.fer);
        expect(newResults.mfi_v).toEqual(originalResults.mfi_v);
        expect(newResults.vpe).toEqual(originalResults.vpe);
        expect(newResults.atr20).toEqual(originalResults.atr20);
        expect(newResults.latest).toEqual(originalResults.latest);
    });
});
