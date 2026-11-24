import { describe, expect, it } from "vitest";
import { activeCell, cellAtPoint, sanitizeDigits } from "./digits";

describe("sanitizeDigits", () => {
  it("keeps digits and the first six", () => {
    expect(sanitizeDigits("12 34-56789")).toBe("123456");
    expect(sanitizeDigits("abc")).toBe("");
    expect(sanitizeDigits("")).toBe("");
  });

  it("reads full-width and other-script numerals as no digit at all", () => {
    expect(sanitizeDigits("１２３")).toBe("");
  });
});

describe("activeCell", () => {
  it("counts the digits before the caret", () => {
    expect(activeCell("123", 3)).toBe(3);
    expect(activeCell("123", 1)).toBe(1);
    expect(activeCell("1 2 3", 3)).toBe(2);
  });

  it("rests on the sixth cell when the caret is past it", () => {
    expect(activeCell("123456", 6)).toBe(5);
  });

  it("reads the whole text when there is no caret", () => {
    expect(activeCell("12", null)).toBe(2);
  });
});

describe("cellAtPoint", () => {
  it("finds the cell under a point of a 240 px field", () => {
    expect(cellAtPoint(10, 0, 240, 6)).toBe(0);
    expect(cellAtPoint(70, 0, 240, 6)).toBe(1);
    expect(cellAtPoint(239, 0, 240, 6)).toBe(5);
  });

  it("never goes past the first empty cell", () => {
    expect(cellAtPoint(239, 0, 240, 2)).toBe(2);
    expect(cellAtPoint(239, 0, 240, 0)).toBe(0);
  });

  it("allows for the field's own left edge, and for a point before it", () => {
    expect(cellAtPoint(110, 100, 240, 6)).toBe(0);
    expect(cellAtPoint(50, 100, 240, 6)).toBe(0);
  });

  it("falls back to the first empty cell where there is no layout", () => {
    expect(cellAtPoint(50, 0, 0, 3)).toBe(3);
    expect(cellAtPoint(50, 0, 0, 6)).toBe(5);
  });
});
