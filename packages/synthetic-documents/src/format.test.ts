import { describe, expect, it } from "vitest";
import {
  printDate,
  printMoney,
  printQuantity,
  toCents,
  trimDecimal,
} from "./format.js";

describe("printing", () => {
  it("writes dates the way a trading document does", () => {
    expect(printDate("2026-11-02")).toBe("02 Nov 2026");
    expect(() => printDate("2026-13-02")).toThrow(RangeError);
  });

  it("groups money and keeps two decimals", () => {
    expect(printMoney("1250.5")).toBe("1,250.50");
    expect(printMoney("12")).toBe("12.00");
    expect(printMoney("24.9500")).toBe("24.95");
    expect(printMoney("1234567.891")).toBe("1,234,567.891");
    expect(printMoney("-5")).toBe("-5.00");
  });

  it("drops decimals a count never has", () => {
    expect(printQuantity("2000.0000")).toBe("2,000");
    expect(printQuantity("1.5")).toBe("1.5");
    expect(trimDecimal("17.00")).toBe("17");
    expect(trimDecimal("17")).toBe("17");
    expect(trimDecimal("16.50")).toBe("16.5");
  });

  it("rounds an amount to the cent, half up", () => {
    expect(toCents("3774.6475")).toBe("3774.65");
    expect(toCents("3774.6449")).toBe("3774.64");
    expect(toCents("0.005")).toBe("0.01");
    expect(toCents("12")).toBe("12.00");
    expect(toCents("0.4")).toBe("0.40");
  });
});
