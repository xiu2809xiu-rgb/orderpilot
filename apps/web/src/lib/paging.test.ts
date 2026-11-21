import { describe, expect, it } from "vitest";
import { clampPage, pageCount } from "./paging";

describe("paging", () => {
  it("counts pages, with one page for an empty list", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(121, 25)).toBe(5);
  });

  it("opens the last page for a number past the end", () => {
    expect(clampPage(99, 121, 25)).toBe(5);
    expect(clampPage(5, 121, 25)).toBe(5);
    expect(clampPage(3, 121, 25)).toBe(3);
  });

  it("never goes below the first page, and keeps page 1 for an empty list", () => {
    expect(clampPage(0, 121, 25)).toBe(1);
    expect(clampPage(-4, 121, 25)).toBe(1);
    expect(clampPage(99, 0, 25)).toBe(1);
  });
});
