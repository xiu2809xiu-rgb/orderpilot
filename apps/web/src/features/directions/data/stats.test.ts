import { describe, expect, it } from "vitest";
import { median, quantile, rootMeanSquare, round } from "./stats.ts";

describe("stats", () => {
  it("finds quantiles by linear interpolation", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantile([10, 20, 30, 40, 50], 0.75)).toBe(40);
  });

  it("does not depend on the order of the input, or change it", () => {
    const values = [5, 1, 4, 2, 3];
    expect(median(values)).toBe(3);
    expect(values).toEqual([5, 1, 4, 2, 3]);
  });

  it("clamps q to the ends of the list", () => {
    expect(quantile([2, 4, 6], -1)).toBe(2);
    expect(quantile([2, 4, 6], 2)).toBe(6);
  });

  it("refuses an empty list", () => {
    expect(() => quantile([], 0.5)).toThrow(RangeError);
    expect(() => rootMeanSquare([])).toThrow(RangeError);
  });

  it("counts a bias in the root mean square", () => {
    expect(rootMeanSquare([3, 4])).toBeCloseTo(Math.sqrt(12.5), 10);
    expect(rootMeanSquare([-2, -2, -2])).toBe(2);
  });

  it("rounds without a negative zero", () => {
    expect(round(2.345, 2)).toBe(2.35);
    expect(round(-0.0001, 2)).toBe(0);
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false);
  });
});
