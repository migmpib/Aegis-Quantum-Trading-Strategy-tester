import { describe, expect, test } from "bun:test";
import { calculate_vwap_deviation_ratio } from "./taUtils";
import type { ProcessedKline } from "../types";

describe("calculate_vwap_deviation_ratio", () => {
  const createKline = (high: number, low: number, close: number, volume: number): ProcessedKline => ({
    timestamp: Date.now(),
    open: (high + low) / 2, // Arbitrary
    high,
    low,
    close,
    volume,
  });

  test("calculates correct deviation ratio for basic input", () => {
    const data: ProcessedKline[] = [
      createKline(10, 8, 9, 100),   // TP = 9, Vol = 100, TP*Vol = 900
      createKline(12, 10, 11, 200), // TP = 11, Vol = 200, TP*Vol = 2200
    ];
    const period = 2;

    // Calculation for index 1 (end of period):
    // Cum TP*Vol = 900 + 2200 = 3100
    // Cum Vol = 100 + 200 = 300
    // VWAP = 3100 / 300 = 10.3333...
    // Close = 11
    // Ratio = ((11 / 10.3333...) - 1) * 100 = 6.4516129...

    const result = calculate_vwap_deviation_ratio(data, period);

    expect(result.length).toBe(2);
    expect(result[0]).toBeNull(); // Index 0 < period - 1
    expect(result[1]).toBeCloseTo(6.4516129, 4);
  });

  test("returns nulls for insufficient data", () => {
    const data: ProcessedKline[] = [
      createKline(10, 8, 9, 100),
    ];
    const period = 5;
    const result = calculate_vwap_deviation_ratio(data, period);

    expect(result.length).toBe(1);
    expect(result[0]).toBeNull();
  });

  test("handles zero volume gracefully", () => {
    const data: ProcessedKline[] = [
        createKline(10, 8, 9, 0),
        createKline(12, 10, 11, 0),
    ];
    const period = 2;
    // VWAP calculation would divide by zero if not handled
    // Code says: const vwap = cumulative_vol > 0 ? cumulative_tp_vol / cumulative_vol : 0;
    // Then: vwap_dev.push(vwap > 0 ? (last_close / vwap - 1) * 100 : null);

    const result = calculate_vwap_deviation_ratio(data, period);

    expect(result.length).toBe(2);
    expect(result[1]).toBeNull();
  });

  test("returns empty array for empty input", () => {
      const data: ProcessedKline[] = [];
      const period = 14;
      const result = calculate_vwap_deviation_ratio(data, period);
      expect(result).toEqual([]);
  });

  test("calculates correctly when period equals length", () => {
      const data: ProcessedKline[] = [
          createKline(10, 8, 9, 100),
          createKline(11, 9, 10, 100),
          createKline(12, 10, 11, 100),
      ];
      const period = 3;
      const result = calculate_vwap_deviation_ratio(data, period);

      expect(result.length).toBe(3);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).not.toBeNull();
  });
});
