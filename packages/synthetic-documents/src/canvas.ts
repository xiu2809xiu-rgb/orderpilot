import { inkExtent, textWidth, type FontId } from "./fonts.js";
import type { DraftField, FieldSpec } from "./model.js";

/** A4 in points. Every position in this package is measured from the top-left corner. */
export const PAGE = { width: 595.28, height: 841.89 } as const;

export type Color = readonly [number, number, number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextOp {
  kind: "text";
  font: FontId;
  size: number;
  /** The left edge of the first glyph, and the baseline. */
  x: number;
  y: number;
  text: string;
  color: Color;
}
export interface RectOp {
  kind: "rect";
  box: Box;
  fill: Color | null;
  stroke: Color | null;
  lineWidth: number;
}
export interface LineOp {
  kind: "line";
  from: readonly [number, number];
  to: readonly [number, number];
  color: Color;
  lineWidth: number;
}
export type DrawOp = TextOp | RectOp | LineOp;

export interface TextStyle {
  font: FontId;
  size: number;
  color?: Color;
  /** Which edge `x` names. Defaults to the left. */
  align?: "left" | "right" | "center";
}

export const BLACK: Color = [0.09, 0.09, 0.1];

// A little air around the ink, so a highlight does not touch the letters.
const PAD = 1.2;

function union(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * A recorded drawing. Layouts draw into it and never touch a PDF, so the same
 * drawing can become a text PDF or a scan, and every field's box comes from
 * the same measurements that placed its text.
 */
export class Canvas {
  readonly pages: DrawOp[][] = [[]];
  readonly fields: DraftField[] = [];

  get page(): number {
    return this.pages.length;
  }

  newPage(): void {
    this.pages.push([]);
  }

  private add(op: DrawOp): void {
    const ops = this.pages[this.pages.length - 1];
    if (!ops) throw new Error("A canvas always has a page");
    ops.push(op);
  }

  /** Draws one line of text and returns the box around its ink. */
  text(text: string, x: number, y: number, style: TextStyle): Box {
    const width = textWidth(style.font, text, style.size);
    let left = x;
    if (style.align === "right") left = x - width;
    if (style.align === "center") left = x - width / 2;
    this.add({
      kind: "text",
      font: style.font,
      size: style.size,
      x: left,
      y,
      text,
      color: style.color ?? BLACK,
    });
    const ink = inkExtent(style.font, text, style.size);
    return {
      x: left - PAD,
      y: y - ink.rise - PAD,
      w: width + 2 * PAD,
      h: ink.rise + ink.fall + 2 * PAD,
    };
  }

  /** Lines under each other. Returns the union of their boxes. */
  lines(
    lines: readonly string[],
    x: number,
    y: number,
    leading: number,
    style: TextStyle,
  ): Box {
    if (lines.length === 0) throw new Error("There is nothing to draw");
    return union(
      lines.map((line, i) => this.text(line, x, y + i * leading, style)),
    );
  }

  /** Breaks a string into lines no wider than `maxWidth`. */
  wrap(text: string, maxWidth: number, font: FontId, size: number): string[] {
    const out: string[] = [];
    let current = "";
    for (const word of text.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (current && textWidth(font, next, size) > maxWidth) {
        out.push(current);
        current = word;
      } else current = next;
    }
    if (current) out.push(current);
    return out;
  }

  rect(
    box: Box,
    paint: { fill?: Color; stroke?: Color; lineWidth?: number },
  ): void {
    this.add({
      kind: "rect",
      box,
      fill: paint.fill ?? null,
      stroke: paint.stroke ?? null,
      lineWidth: paint.lineWidth ?? 0.6,
    });
  }

  line(
    from: readonly [number, number],
    to: readonly [number, number],
    color: Color,
    lineWidth = 0.6,
  ): void {
    this.add({ kind: "line", from, to, color, lineWidth });
  }

  /** Draws a field's text and records where it went. */
  put(spec: FieldSpec, x: number, y: number, style: TextStyle): Box {
    const box = this.text(spec.text, x, y, style);
    this.mark(spec, box);
    return box;
  }

  /** The same for a value on several lines, such as an address. */
  putLines(
    spec: FieldSpec,
    x: number,
    y: number,
    leading: number,
    style: TextStyle,
  ): Box {
    const box = this.lines(spec.text.split("\n"), x, y, leading, style);
    this.mark(spec, box);
    return box;
  }

  /** Records that `spec` sits in `box` on the current page. */
  mark(spec: FieldSpec, box: Box): void {
    if (
      this.fields.some(
        (f) => f.key === spec.key && f.lineIndex === spec.lineIndex,
      )
    ) {
      throw new Error(`The field ${spec.key} is drawn twice`);
    }
    this.fields.push({ ...spec, page: this.page, box });
  }
}
