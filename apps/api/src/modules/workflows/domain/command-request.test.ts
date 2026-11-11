import { describe, expect, it } from "vitest";
import { requestHashOf } from "./command-request.js";

describe("requestHashOf", () => {
  it("gives the same request the same hash", () => {
    expect(requestHashOf("spr.approve", "SPR-1", { comment: "Fine" })).toBe(
      requestHashOf("spr.approve", "SPR-1", { comment: "Fine" }),
    );
  });

  it("ignores the order the body's fields were written in", () => {
    expect(requestHashOf("x.do", "T", { a: 1, b: { c: 2, d: 3 } })).toBe(
      requestHashOf("x.do", "T", { b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it("tells apart a different command, target or body", () => {
    const base = requestHashOf("spr.approve", "SPR-1", { comment: "Fine" });
    expect(requestHashOf("spr.reject", "SPR-1", { comment: "Fine" })).not.toBe(
      base,
    );
    expect(requestHashOf("spr.approve", "SPR-2", { comment: "Fine" })).not.toBe(
      base,
    );
    expect(
      requestHashOf("spr.approve", "SPR-1", { comment: "Other" }),
    ).not.toBe(base);
  });

  it("does not read a field name as part of the value next to it", () => {
    expect(requestHashOf("a", "b", {})).not.toBe(requestHashOf("a", "", {}));
    expect(requestHashOf("ab", "", {})).not.toBe(requestHashOf("a", "b", {}));
  });
});
