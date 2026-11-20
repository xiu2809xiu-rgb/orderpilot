import { describe, expect, it } from "vitest";
import { normalisePoNumber, poMatchKey } from "./po-number.js";

describe("normalisePoNumber", () => {
  it("trims and collapses runs of spaces, and keeps the case", () => {
    expect(normalisePoNumber("  PO  7788 \t a ")).toBe("PO 7788 a");
    expect(normalisePoNumber("po-1")).toBe("po-1");
  });
});

describe("poMatchKey", () => {
  it("ignores case, outer spaces and spaces inside", () => {
    expect(poMatchKey("AUD-DUP- 011930")).toBe("AUD-DUP-011930");
    expect(poMatchKey("  aud-dup-011930 ")).toBe("AUD-DUP-011930");
    expect(poMatchKey("PO \t 7788")).toBe("PO7788");
  });
  it("keeps other characters, so different numbers stay different", () => {
    expect(poMatchKey("PO-77_88")).not.toBe(poMatchKey("PO-7788"));
    expect(poMatchKey("PO-1")).not.toBe(poMatchKey("PO-10"));
  });
});
