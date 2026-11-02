import { describe, expect, it } from "vitest";
import { normaliseDecimal } from "./decimal";

describe("normaliseDecimal", () => {
  it("pads, trims and drops grouping commas", () => {
    expect(normaliseDecimal(" 1,200.5 ", 2)).toBe("1200.50");
    expect(normaliseDecimal("1,20,000", 2)).toBe("120000.00");
    expect(normaliseDecimal("007", 0)).toBe("7");
    expect(normaliseDecimal("-3.1", 2)).toBe("-3.10");
  });

  it("leaves a decimal comma for the schema to refuse", () => {
    // Read as grouping, "12,50" would be 1250.00: a hundred times too large.
    expect(normaliseDecimal("12,50", 2)).toBe("12,50");
    expect(normaliseDecimal("1,2345", 2)).toBe("1,2345");
  });

  it("never rounds", () => {
    expect(normaliseDecimal("1.239", 2)).toBe("1.239");
  });
});
