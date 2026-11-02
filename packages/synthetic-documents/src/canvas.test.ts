import { describe, expect, it } from "vitest";
import { Canvas } from "./canvas.js";
import type { FontId } from "./fonts.js";
import { textOutlines } from "./glyphs.js";
import { spec } from "./model.js";
import { Raster, stroke } from "./raster.js";

const GRID = 6;

/** Where the ink of a string really is, found by painting its outlines and looking. */
function inkBounds(
  font: FontId,
  text: string,
  size: number,
  x: number,
  y: number,
) {
  const raster = new Raster(Math.ceil(300 * GRID), Math.ceil(80 * GRID));
  raster.fill(
    textOutlines(
      { kind: "text", font, size, x, y, text, color: [0, 0, 0] },
      ([px, py]) => [px * GRID, py * GRID],
    ),
    0,
  );
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let py = 0; py < raster.height; py++) {
    for (let px = 0; px < raster.width; px++) {
      if ((raster.value[py * raster.width + px] ?? 1) > 0.5) continue;
      left = Math.min(left, px);
      right = Math.max(right, px + 1);
      top = Math.min(top, py);
      bottom = Math.max(bottom, py + 1);
    }
  }
  return {
    left: left / GRID,
    right: right / GRID,
    top: top / GRID,
    bottom: bottom / GRID,
  };
}

describe("a text box", () => {
  const cases: [FontId, string, number][] = [
    ["sans", "PO-IN-4898", 10],
    ["sansBold", "Quillon Harbour Traders", 14],
    ["mono", "Godown 3, Old Customs Road", 7.2],
    ["serif", "Yours faithfully, gypsy", 10.5],
    ["serifBold", "1,250.50 Qjy", 11],
  ];

  it.each(cases)("wraps the ink of %s %j tightly", (font, text, size) => {
    const canvas = new Canvas();
    const box = canvas.text(text, 20, 40, { font, size });
    const ink = inkBounds(font, text, size, 20, 40);
    expect(ink.left).toBeGreaterThanOrEqual(box.x - 0.2);
    expect(ink.right).toBeLessThanOrEqual(box.x + box.w + 0.2);
    expect(ink.top).toBeGreaterThanOrEqual(box.y - 0.2);
    expect(ink.bottom).toBeLessThanOrEqual(box.y + box.h + 0.2);
    // Tight: no more than the padding and the side bearings beyond the ink.
    expect(ink.left - box.x).toBeLessThan(3);
    expect(box.x + box.w - ink.right).toBeLessThan(3);
    expect(ink.top - box.y).toBeLessThan(2.5);
    expect(box.y + box.h - ink.bottom).toBeLessThan(2.5);
  });

  it("follows the right edge for right-aligned text", () => {
    const canvas = new Canvas();
    const box = canvas.text("1,250.50", 200, 40, {
      font: "sans",
      size: 10,
      align: "right",
    });
    expect(box.x + box.w).toBeCloseTo(200 + 1.2, 5);
  });
});

describe("a canvas", () => {
  it("refuses to draw a field twice", () => {
    const canvas = new Canvas();
    const field = spec("poNumber", "PO number", "header", "PO-1");
    canvas.put(field, 10, 20, { font: "sans", size: 9 });
    expect(() => canvas.put(field, 10, 40, { font: "sans", size: 9 })).toThrow(
      "drawn twice",
    );
  });

  it("records the page a field was drawn on", () => {
    const canvas = new Canvas();
    canvas.newPage();
    canvas.put(spec("a", "A", "header", "x"), 10, 20, {
      font: "sans",
      size: 9,
    });
    expect(canvas.fields[0]?.page).toBe(2);
  });

  it("wraps words without breaking one", () => {
    const canvas = new Canvas();
    const lines = canvas.wrap(
      "Wireless Mouse 2.4GHz Ergonomic Pro",
      90,
      "sans",
      9,
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("Wireless Mouse 2.4GHz Ergonomic Pro");
  });
});

describe("the rasteriser", () => {
  it("fills a square with exact coverage and leaves the rest alone", () => {
    const raster = new Raster(10, 10);
    raster.fill(
      [
        [
          [2, 2],
          [6, 2],
          [6, 6],
          [2, 6],
        ],
      ],
      0,
    );
    expect(raster.value[3 * 10 + 3]).toBe(0);
    expect(raster.value[0]).toBe(1);
    raster.fill(
      [
        [
          [7.5, 0],
          [8.5, 0],
          [8.5, 1],
          [7.5, 1],
        ],
      ],
      0,
    );
    expect(raster.value[7]).toBeCloseTo(0.5, 5);
    expect(raster.value[8]).toBeCloseTo(0.5, 5);
  });

  it("leaves a hole where a contour winds the other way", () => {
    const raster = new Raster(10, 10);
    raster.fill(
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        [
          [3, 3],
          [3, 7],
          [7, 7],
          [7, 3],
        ],
      ],
      0,
    );
    expect(raster.value[5 * 10 + 5]).toBe(1);
    expect(raster.value[1 * 10 + 1]).toBe(0);
  });

  it("draws a thick line between two points", () => {
    const raster = new Raster(10, 10);
    raster.fill([stroke([0, 5], [10, 5], 2)], 0);
    expect(raster.value[5 * 10 + 5]).toBe(0);
    expect(raster.value[2 * 10 + 5]).toBe(1);
  });
});
