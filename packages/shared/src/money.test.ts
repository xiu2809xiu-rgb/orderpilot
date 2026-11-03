import { describe, expect, it } from "vitest";
import {
  isDecimalString,
  isLineAmountTooLarge,
  lineAmount,
  shortfallOf,
  subtractDecimal,
  sumDecimal,
} from "./money.js";

describe("the decimal helpers a lines grid uses", () => {
  it("multiplies 3 by 19.99 exactly", () => {
    expect(lineAmount("3", "19.99")).toBe("59.97");
  });

  it("is exact where a float is not", () => {
    expect(3 * 0.1).not.toBe(0.3);
    expect(lineAmount("3", "0.1")).toBe("0.30");
    expect(lineAmount("7", "1.15")).toBe("8.05");
  });

  it("rounds a line to the cent, half away from zero", () => {
    expect(lineAmount("3", "0.335")).toBe("1.01");
    expect(lineAmount("0.5", "0.01")).toBe("0.01");
    expect(lineAmount("-2", "0.335")).toBe("-0.67");
  });

  it("gives no amount while a number is empty or half typed", () => {
    expect(lineAmount("", "19.99")).toBeNull();
    expect(lineAmount("3.", "19.99")).toBeNull();
    expect(lineAmount("3", "abc")).toBeNull();
    expect(lineAmount("1,200", "2")).toBeNull();
    expect(lineAmount("3", "1e3")).toBeNull();
  });

  it("gives no amount, and does not throw, when the product is too large", () => {
    expect(lineAmount("100000000", "10000000.00")).toBeNull();
    expect(lineAmount("99999999", "99999999.99")).toBeNull();
    expect(lineAmount("999999999999999", "2")).toBeNull();
    expect(lineAmount("-999999999999999", "2")).toBeNull();
    expect(isLineAmountTooLarge("99999999", "99999999.99")).toBe(true);
    expect(isLineAmountTooLarge("3", "19.99")).toBe(false);
    expect(isLineAmountTooLarge("3.", "19.99")).toBe(false);
  });

  it("still prices the largest line it can hold", () => {
    expect(lineAmount("999999999999999", "1")).toBe("999999999999999.00");
  });

  it("gives no amount when rounding adds a sixteenth digit", () => {
    expect(lineAmount("999999999999999.9999", "1")).toBeNull();
  });

  it("sums without float error and without a size limit on the total", () => {
    expect(sumDecimal(["0.10", "0.20", "0.30"])).toBe("0.60");
    expect(sumDecimal([])).toBe("0.00");
    expect(sumDecimal(["999999999999999", "999999999999999", "1"])).toBe(
      "1999999999999999.00",
    );
    expect(sumDecimal(["59.97", "-10.50"])).toBe("49.47");
  });

  it("subtracts exactly", () => {
    expect(subtractDecimal("0.3", "0.1")).toBe("0.20");
    expect(subtractDecimal("1", "1.5")).toBe("-0.50");
  });

  it("finds a shortfall only when the quantity is above what is available", () => {
    expect(shortfallOf("12", "8")).toBe("4.00");
    expect(shortfallOf("8", "8")).toBeNull();
    expect(shortfallOf("7.5", "8")).toBeNull();
    expect(shortfallOf("", "8")).toBeNull();
    expect(shortfallOf("12", "-3")).toBe("15.00");
  });

  it("tells a decimal string from other text", () => {
    expect(isDecimalString("12.5")).toBe(true);
    expect(isDecimalString("12.")).toBe(false);
    expect(isDecimalString("")).toBe(false);
  });
});
