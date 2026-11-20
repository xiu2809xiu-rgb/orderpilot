import { describe, expect, it } from "vitest";
import { LOW_STOCK_THRESHOLD } from "./index.js";

describe("the Low stock threshold", () => {
  // The API compares available stock with it and the web app prints it, so it
  // must be a quantity a person can read: a positive whole number.
  it("is a positive whole number, shared by the API and the web app", () => {
    expect(Number.isInteger(LOW_STOCK_THRESHOLD)).toBe(true);
    expect(LOW_STOCK_THRESHOLD).toBeGreaterThan(0);
  });
});
