import { describe, expect, it } from "vitest";
import {
  RANGE_MULTIPLIER,
  SEASON,
  monthsAfter,
  seasonalNaive,
} from "./forecast";
import { SALES_HISTORY } from "./index";

/** Two years, the second 10 above the first in every month, so the error is exactly 10. */
const twoYears = [
  ...Array.from({ length: 12 }, (_, i) => 100 + i),
  ...Array.from({ length: 12 }, (_, i) => 110 + i),
];

describe("monthsAfter", () => {
  it("steps across a year end", () => {
    expect(monthsAfter("2026-10", 1)).toBe("2026-11");
    expect(monthsAfter("2026-10", 3)).toBe("2027-01");
    expect(monthsAfter("2026-12", 12)).toBe("2027-12");
  });
});

describe("seasonalNaive", () => {
  it("repeats the same month a year earlier", () => {
    const { points } = seasonalNaive(twoYears, "2026-10", 6);
    expect(points.map((p) => p.forecast)).toEqual([
      110, 111, 112, 113, 114, 115,
    ]);
    expect(points[0]?.month).toBe("2026-11");
    expect(points[5]?.month).toBe("2027-04");
  });

  it("takes the range from the error the method made on the past", () => {
    const { points, error, errorMonths } = seasonalNaive(
      twoYears,
      "2026-10",
      3,
    );
    expect(error).toBe(10);
    expect(errorMonths).toBe(12);
    const spread = RANGE_MULTIPLIER * 10;
    expect(points[0]?.low).toBeCloseTo(110 - spread, 2);
    expect(points[0]?.high).toBeCloseTo(110 + spread, 2);
  });

  it("has no range when the method was never wrong", () => {
    const flat = [...twoYears.slice(0, 12), ...twoYears.slice(0, 12)];
    const { points, error } = seasonalNaive(flat, "2026-10", 2);
    expect(error).toBe(0);
    expect(points[0]?.low).toBe(points[0]?.forecast);
    expect(points[0]?.high).toBe(points[0]?.forecast);
  });

  it("never lets the range go below zero", () => {
    const small = [
      ...Array.from({ length: 12 }, () => 1),
      ...Array.from({ length: 12 }, () => 50),
    ];
    const { points } = seasonalNaive(small, "2026-10", 1);
    expect(points[0]?.low).toBe(0);
  });

  it("refuses less than two seasons of history and a horizon past a year", () => {
    expect(() => seasonalNaive(twoYears.slice(1), "2026-10")).toThrow(
      RangeError,
    );
    expect(() => seasonalNaive(twoYears, "2026-10", 13)).toThrow(RangeError);
    expect(() => seasonalNaive(twoYears, "2026-10", 0)).toThrow(RangeError);
  });

  it("agrees with the forecast the data script wrote", () => {
    const last = SALES_HISTORY.months[SALES_HISTORY.months.length - 1] ?? "";
    const again = seasonalNaive(SALES_HISTORY.total.amountUsd, last, 6);
    expect(again.points).toEqual(SALES_HISTORY.forecast.amountUsd);
    expect(SALES_HISTORY.forecast.season).toBe(SEASON);
  });
});
