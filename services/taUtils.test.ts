import { expect, test, describe } from "bun:test";
import { calculateSMA, calculateEMA } from "./taUtils";

describe("taUtils Moving Averages", () => {
    describe("calculateSMA", () => {
        test("should return null array if data length is less than period", () => {
            const data = [1, 2, 3];
            const period = 5;
            const result = calculateSMA(data, period);
            expect(result).toEqual([null, null, null]);
        });

        test("should calculate SMA correctly", () => {
            const data = [10, 20, 30, 40, 50];
            const period = 3;
            const result = calculateSMA(data, period);
            // Expected: [null, null, 20, 30, 40]
            // Period 1-3: (10+20+30)/3 = 20
            // Period 2-4: (20+30+40)/3 = 30
            // Period 3-5: (30+40+50)/3 = 40
            expect(result).toEqual([null, null, 20, 30, 40]);
        });

        test("should handle float values correctly", () => {
             const data = [1.5, 2.5, 3.5, 4.5];
             const period = 2;
             const result = calculateSMA(data, period);
             // Expected: [null, 2, 3, 4]
             // Period 1-2: (1.5+2.5)/2 = 2
             // Period 2-3: (2.5+3.5)/2 = 3
             // Period 3-4: (3.5+4.5)/2 = 4
             expect(result).toEqual([null, 2, 3, 4]);
        });
    });

    describe("calculateEMA", () => {
        test("should return null array if data length is less than period", () => {
            const data = [1, 2, 3];
            const period = 5;
            const result = calculateEMA(data, period);
            expect(result).toEqual([null, null, null]);
        });

        test("should calculate EMA correctly", () => {
            const data = [10, 10, 10, 20, 20];
            const period = 3;
            // k = 2 / (3 + 1) = 0.5
            // Initial SMA (first 3): (10+10+10)/3 = 10
            // EMA[2] = 10
            // EMA[3] (20): (20 - 10) * 0.5 + 10 = 15
            // EMA[4] (20): (20 - 15) * 0.5 + 15 = 17.5
            const result = calculateEMA(data, period);
            expect(result).toEqual([null, null, 10, 15, 17.5]);
        });

        test("should handle single value period correctly", () => {
            const data = [10, 20, 30];
            const period = 1;
            // k = 2 / (1 + 1) = 1
            // Initial SMA (first 1): 10 / 1 = 10
            // EMA[0] = 10
            // EMA[1] (20): (20 - 10) * 1 + 10 = 20
            // EMA[2] (30): (30 - 20) * 1 + 20 = 30
            const result = calculateEMA(data, period);
            expect(result).toEqual([10, 20, 30]);
        });
    });
});
