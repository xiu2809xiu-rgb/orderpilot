import { describe, expect, it } from "vitest";
import { normalisePoNumber } from "./po-number.js";

describe("normalisePoNumber", () => {
  it("trims and collapses runs of spaces, and keeps the case", () => {
    expect(normalisePoNumber("  PO  7788 \t a ")).toBe("PO 7788 a");
    expect(normalisePoNumber("po-1")).toBe("po-1");
  });
});
