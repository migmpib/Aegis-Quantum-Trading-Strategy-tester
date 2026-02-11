import { describe, expect, test } from "bun:test";
import { calculateOBV } from "./taUtils";

describe("calculateOBV", () => {
    test("should correctly calculate OBV for a bullish trend", () => {
        const closes = [10, 12, 14, 16];
        const volumes = [100, 200, 300, 400];
        // i=1: 12 > 10 -> obv[1] = 0 + 200 = 200
        // i=2: 14 > 12 -> obv[2] = 200 + 300 = 500
        // i=3: 16 > 14 -> obv[3] = 500 + 400 = 900
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0, 200, 500, 900]);
    });

    test("should correctly calculate OBV for a bearish trend", () => {
        const closes = [20, 18, 16, 14];
        const volumes = [100, 200, 300, 400];
        // i=1: 18 < 20 -> obv[1] = 0 - 200 = -200
        // i=2: 16 < 18 -> obv[2] = -200 - 300 = -500
        // i=3: 14 < 16 -> obv[3] = -500 - 400 = -900
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0, -200, -500, -900]);
    });

    test("should correctly calculate OBV for a flat trend", () => {
        const closes = [10, 10, 10, 10];
        const volumes = [100, 200, 300, 400];
        // Price unchanged, OBV remains same as previous
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0, 0, 0, 0]);
    });

    test("should correctly calculate OBV for mixed market conditions", () => {
        const closes = [10, 12, 11, 11, 13];
        const volumes = [100, 200, 150, 100, 250];
        // i=1: 12 > 10 -> 0 + 200 = 200
        // i=2: 11 < 12 -> 200 - 150 = 50
        // i=3: 11 == 11 -> 50 (unchanged)
        // i=4: 13 > 11 -> 50 + 250 = 300
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0, 200, 50, 50, 300]);
    });

    test("should handle empty arrays (current behavior returns [0])", () => {
        const closes: number[] = [];
        const volumes: number[] = [];
        const result = calculateOBV(closes, volumes);
        // Current implementation initializes with [0] and returns it if loop doesn't run
        expect(result).toEqual([0]);
    });

    test("should handle single element arrays", () => {
        const closes = [10];
        const volumes = [100];
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0]);
    });

    test("should handle zero volume", () => {
        const closes = [10, 12, 11];
        const volumes = [100, 0, 0];
        // i=1: 12 > 10 -> 0 + 0 = 0
        // i=2: 11 < 12 -> 0 - 0 = 0
        const result = calculateOBV(closes, volumes);
        expect(result).toEqual([0, 0, 0]);
    });
});
