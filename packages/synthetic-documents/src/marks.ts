import type { Box, Canvas, Color } from "./canvas.js";
import { textWidth } from "./fonts.js";

/**
 * Marks a person leaves on paper: a signature and a rubber stamp. They are
 * decoration, drawn as lines and text and never recorded as fields, so a
 * reader of the page has nothing to extract from them. Both are made of
 * nothing but their inputs, so the same call draws the same ink on any day.
 */

// Blue-grey ink: dark enough to survive being scanned at 100 dots an inch.
const INK: Color = [0.14, 0.18, 0.34];
const STAMP_INK: Color = [0.25, 0.33, 0.55];

const SEGMENTS = 11;
const SPAN = 96;
const SWING = 13;

/** A number in [0, 1) from two small integers: a hash, not a random source. */
function unit(seed: number, step: number): number {
  let h = Math.imul(seed + 1, 374761393) ^ Math.imul(step + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A scribbled name, twelve strokes: eleven joined segments that wander up and
 * down along a line, and a flourish under them. `x` and `y` are the left end
 * of the line the person signed on. Returns the box around the ink.
 */
export function signature(
  canvas: Canvas,
  x: number,
  y: number,
  seed: number,
): Box {
  let from: [number, number] = [x, y - SWING * (0.2 + unit(seed, 0))];
  let top = from[1];
  let bottom = from[1];
  for (let i = 1; i <= SEGMENTS; i++) {
    const to: [number, number] = [
      x + (SPAN * i) / SEGMENTS + (unit(seed, 40 + i) - 0.5) * 4,
      y - SWING * (unit(seed, i) * 2 - 0.6),
    ];
    canvas.line(from, to, INK, 1.1);
    top = Math.min(top, to[1]);
    bottom = Math.max(bottom, to[1]);
    from = to;
  }
  const flourish = y + 4 + unit(seed, 99) * 3;
  canvas.line([x + 8, flourish], [from[0] + 6, flourish - 2], INK, 0.9);
  bottom = Math.max(bottom, flourish);
  return { x, y: top, w: from[0] + 6 - x, h: bottom - top };
}

const STAMP_SIZE = 9;
const STAMP_LEADING = 13;

/**
 * A rubber stamp: a double frame with the lines of text centred inside it, in
 * ink that is not black. Throws when the text does not fit the box.
 */
export function rubberStamp(
  canvas: Canvas,
  box: Box,
  lines: readonly string[],
): void {
  const widest = Math.max(
    ...lines.map((line) => textWidth("sansBold", line, STAMP_SIZE)),
  );
  const height = STAMP_LEADING * lines.length;
  if (lines.length === 0 || widest > box.w - 12 || height > box.h - 6) {
    throw new RangeError("The stamp text does not fit its box");
  }
  canvas.rect(box, { stroke: STAMP_INK, lineWidth: 1.6 });
  canvas.rect(
    { x: box.x + 3, y: box.y + 3, w: box.w - 6, h: box.h - 6 },
    { stroke: STAMP_INK, lineWidth: 0.6 },
  );
  const first = box.y + (box.h - height) / 2 + STAMP_SIZE;
  lines.forEach((line, i) => {
    canvas.text(line, box.x + box.w / 2, first + i * STAMP_LEADING, {
      font: "sansBold",
      size: STAMP_SIZE,
      color: STAMP_INK,
      align: "center",
    });
  });
}
