
import { expect, test, describe } from "bun:test";
import { calculateVWAP, calculate_vwap_deviation_ratio, calculate_fractal_efficiency_ratio } from "./taUtils";
import { ProcessedKline } from "../types";

describe("taUtils optimization verification", () => {
    const mockData: ProcessedKline[] = [
        { timestamp: 0, open: 10, high: 12, low: 8, close: 11, volume: 100 },
        { timestamp: 1, open: 11, high: 13, low: 10, close: 12, volume: 150 },
        { timestamp: 2, open: 12, high: 14, low: 11, close: 13, volume: 200 },
        { timestamp: 3, open: 13, high: 15, low: 12, close: 14, volume: 250 },
        { timestamp: 4, open: 14, high: 16, low: 13, close: 15, volume: 300 },
    ];
    const period = 3;

    test("calculateVWAP should return correct values", () => {
        const result = calculateVWAP(mockData, period);
        expect(result.length).toBe(5);
        expect(result[0]).toBeNull();
        expect(result[1]).toBeNull();

        // Manual calculation for index 2 (window 0, 1, 2)
        // TP0 = (12+8+11)/3 = 31/3; TP0*V0 = (31/3)*100 = 3100/3 = 1033.33
        // TP1 = (13+10+12)/3 = 35/3; TP1*V1 = (35/3)*150 = 35*50 = 1750
        // TP2 = (14+11+13)/3 = 38/3; TP2*V2 = (38/3)*200 = 7600/3 = 2533.33
        // CumTPV = 1033.33 + 1750 + 2533.33 = 5316.66...
        // CumVol = 100 + 150 + 200 = 450
        // VWAP = 5316.66 / 450 = 11.8148...

        expect(result[2]).toBeCloseTo(11.8148, 4);

        // Manual calculation for index 3 (window 1, 2, 3)
        // TP3 = (15+12+14)/3 = 41/3; TP3*V3 = (41/3)*250 = 10250/3 = 3416.66
        // CumTPV = 1750 + 2533.33 + 3416.66 = 7700
        // CumVol = 150 + 200 + 250 = 600
        // VWAP = 7700 / 600 = 12.8333...
        expect(result[3]).toBeCloseTo(12.8333, 4);
    });

    test("calculate_vwap_deviation_ratio should return correct values", () => {
        const result = calculate_vwap_deviation_ratio(mockData, period);
        expect(result.length).toBe(5);
        expect(result[0]).toBeNull();
        expect(result[1]).toBeNull();

        // VWAP2 = 11.8148...
        // Close2 = 13
        // Ratio2 = (13 / 11.8148 - 1) * 100 = 10.031...
        expect(result[2]).toBeCloseTo(10.031, 3);
    });

    test("calculate_fractal_efficiency_ratio should return correct values", () => {
        const result = calculate_fractal_efficiency_ratio(mockData, period);
        expect(result.length).toBe(5);
        expect(result[0]).toBeNull();
        expect(result[1]).toBeNull();
        expect(result[2]).toBeNull(); // FER uses i < period?
        // Wait, looking at code: if (i < period) { fer.push(null); continue; }
        // For i=3, period=3: price_change = abs(close3 - close0) = abs(14 - 11) = 3
        // path_length = abs(close1-close0) + abs(close2-close1) + abs(close3-close2)
        // = abs(12-11) + abs(13-12) + abs(14-13) = 1 + 1 + 1 = 3
        // FER = 3 / 3 = 1
        expect(result[3]).toBe(1);
    });
});
