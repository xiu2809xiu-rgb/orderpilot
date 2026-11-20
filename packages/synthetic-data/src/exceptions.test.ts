import { describe, expect, it } from "vitest";
import { shortfallText } from "./exceptions.js";
import { syntheticDataset } from "./index.js";

describe("the words of a quantity exception", () => {
  it("makes the unit word follow the number", () => {
    expect(shortfallText(1)).toBe("1 unit fewer than the PO");
    expect(shortfallText(2)).toBe("2 units fewer than the PO");
    expect(shortfallText(120)).toBe("120 units fewer than the PO");
  });

  it("never prints 1 units or 1 days in the generated exceptions", () => {
    const { exceptions } = syntheticDataset();
    expect(exceptions.length).toBeGreaterThan(0);
    for (const exception of exceptions) {
      expect(exception.difference).not.toMatch(/\b1 (units|days)\b/);
    }
  });
});
