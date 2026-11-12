import { describe, expect, it } from "vitest";
import { Canvas, PAGE } from "./canvas.js";
import { rubberStamp, signature } from "./marks.js";
import { scanPages } from "./scan.js";
import { inkAround } from "./testing/ink.js";
import { pageImage } from "./testing/pdf-reader.js";

describe("signature", () => {
  it("is twelve strokes, all lines, and never a field", () => {
    const canvas = new Canvas();
    signature(canvas, 100, 200, 7);
    expect(canvas.pages[0]).toHaveLength(12);
    expect(canvas.pages[0]?.every((op) => op.kind === "line")).toBe(true);
    expect(canvas.fields).toEqual([]);
  });

  it("is the same every time for one seed and differs between seeds", () => {
    const draw = (seed: number): unknown => {
      const canvas = new Canvas();
      signature(canvas, 100, 200, seed);
      return canvas.pages;
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });

  it("stays inside the box it reports, and near its line", () => {
    for (const seed of [0, 1, 2, 31, 4096]) {
      const canvas = new Canvas();
      const box = signature(canvas, 100, 200, seed);
      for (const op of canvas.pages[0] ?? []) {
        if (op.kind !== "line") continue;
        for (const [x, y] of [op.from, op.to]) {
          expect(x).toBeGreaterThanOrEqual(box.x - 0.001);
          expect(x).toBeLessThanOrEqual(box.x + box.w + 0.001);
          expect(y).toBeGreaterThanOrEqual(box.y - 0.001);
          expect(y).toBeLessThanOrEqual(box.y + box.h + 0.001);
        }
      }
      expect(box.y).toBeGreaterThan(200 - 30);
      expect(box.y + box.h).toBeLessThan(200 + 12);
    }
  });
});

describe("rubberStamp", () => {
  const BOX = { x: 300, y: 600, w: 150, h: 60 };

  it("draws a double frame and the lines of text, not black, and no field", () => {
    const canvas = new Canvas();
    rubberStamp(canvas, BOX, ["RECEIVED", "12 NOV 2026"]);
    const ops = canvas.pages[0] ?? [];
    expect(ops.filter((op) => op.kind === "rect")).toHaveLength(2);
    expect(ops.flatMap((op) => (op.kind === "text" ? [op.text] : []))).toEqual([
      "RECEIVED",
      "12 NOV 2026",
    ]);
    for (const op of ops) {
      const color = op.kind === "rect" ? op.stroke : op.color;
      expect(color?.[2]).toBeGreaterThan(color?.[0] ?? 1);
    }
    expect(canvas.fields).toEqual([]);
  });

  it("keeps its text inside the frame", () => {
    const canvas = new Canvas();
    rubberStamp(canvas, BOX, ["RECEIVED", "12 NOV 2026"]);
    for (const op of canvas.pages[0] ?? []) {
      if (op.kind !== "text") continue;
      expect(op.y).toBeGreaterThan(BOX.y);
      expect(op.y).toBeLessThan(BOX.y + BOX.h);
      expect(op.x).toBeGreaterThanOrEqual(BOX.x);
    }
  });

  it("refuses text that does not fit its box", () => {
    const stamp = (lines: string[]) => () => {
      rubberStamp(new Canvas(), BOX, lines);
    };
    expect(stamp(["A VERY LONG LINE OF STAMP TEXT HERE"])).toThrow(RangeError);
    expect(stamp(["A", "B", "C", "D", "E"])).toThrow(RangeError);
    expect(stamp([])).toThrow(RangeError);
  });
});

describe("marks in a scan", () => {
  it("are ink on the page, so a reader of pixels sees them", async () => {
    const canvas = new Canvas();
    const sign = signature(canvas, 100, 300, 3);
    rubberStamp(canvas, { x: 300, y: 250, w: 150, h: 60 }, ["RECEIVED"]);
    const scan = await scanPages(canvas.pages, {
      title: "t",
      subject: "s",
      keywords: [],
    });
    const image = await pageImage(scan.bytes);
    if (!image) throw new Error("A scan has no image");
    for (const box of [sign, { x: 300, y: 250, w: 150, h: 60 }]) {
      const moved = scan.moveBox(box);
      const { within } = inkAround(
        image,
        { width: PAGE.width, height: PAGE.height },
        [
          moved.x / PAGE.width,
          moved.y / PAGE.height,
          moved.w / PAGE.width,
          moved.h / PAGE.height,
        ],
      );
      expect(within).toBeGreaterThan(40);
    }
  });
});
