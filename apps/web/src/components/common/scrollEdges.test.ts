import { describe, expect, it } from "vitest";
import { moreSides } from "./scrollEdges";

describe("moreSides", () => {
  it("shows no side when the content fits", () => {
    expect(
      moreSides({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }),
    ).toEqual({ start: false, end: false });
  });

  it("shows no side when the box is wider than its content", () => {
    expect(
      moreSides({ scrollLeft: 0, clientWidth: 400, scrollWidth: 300 }),
    ).toEqual({ start: false, end: false });
  });

  it("shows the end only at the start of a wide box", () => {
    expect(
      moreSides({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }),
    ).toEqual({ start: false, end: true });
  });

  it("shows both sides in the middle", () => {
    expect(
      moreSides({ scrollLeft: 300, clientWidth: 300, scrollWidth: 900 }),
    ).toEqual({ start: true, end: true });
  });

  it("shows the start only at the end", () => {
    expect(
      moreSides({ scrollLeft: 600, clientWidth: 300, scrollWidth: 900 }),
    ).toEqual({ start: true, end: false });
  });

  it("treats a scroll position 1 px off the start as the start", () => {
    expect(
      moreSides({ scrollLeft: 1, clientWidth: 300, scrollWidth: 900 }).start,
    ).toBe(false);
    expect(
      moreSides({ scrollLeft: 2, clientWidth: 300, scrollWidth: 900 }).start,
    ).toBe(true);
  });

  it("treats a scroll position 1 px short of the end as the end", () => {
    expect(
      moreSides({ scrollLeft: 599, clientWidth: 300, scrollWidth: 900 }).end,
    ).toBe(false);
    expect(
      moreSides({ scrollLeft: 598, clientWidth: 300, scrollWidth: 900 }).end,
    ).toBe(true);
  });

  it("shows nothing for content only 1 px wider than its box", () => {
    expect(
      moreSides({ scrollLeft: 0, clientWidth: 300, scrollWidth: 301 }),
    ).toEqual({ start: false, end: false });
  });

  it("reads a fractional scroll position", () => {
    expect(
      moreSides({ scrollLeft: 599.5, clientWidth: 300, scrollWidth: 900 }).end,
    ).toBe(false);
    expect(
      moreSides({ scrollLeft: 1.5, clientWidth: 300, scrollWidth: 900 }).start,
    ).toBe(true);
    expect(
      moreSides({ scrollLeft: 0.4, clientWidth: 300, scrollWidth: 900 }).start,
    ).toBe(false);
  });
});
