import { BLACK, type Canvas, type Color } from "./canvas.js";
import type { LineFields } from "./fields.js";
import type { FontId } from "./fonts.js";

/** `no`, `uom`, `discount` and `delivery` are printed but are not fields anyone extracts. */
export type StaticColumn = "no" | "uom" | "discount" | "delivery";
export type ColumnId = StaticColumn | keyof LineFields;

const STATICS: readonly ColumnId[] = ["no", "uom", "discount", "delivery"];
const isStatic = (id: ColumnId): id is StaticColumn => STATICS.includes(id);

export interface Column {
  id: ColumnId;
  label: string;
  width: number;
  align?: "left" | "right";
}

/** How a lines table looks. The data in it never changes, only this. */
export interface TableLook {
  font: FontId;
  bold: FontId;
  size: number;
  headFill?: Color;
  headColor: Color;
  /** Line under the heading, and between rows when `rowRule` is set. */
  rule: Color;
  rowRule?: boolean;
  zebra?: Color;
  /** Lines between the columns too, as on a boxed form. */
  grid?: boolean;
  padX: number;
  padY: number;
}

const HEAD_HEIGHT_PAD = 2;

/**
 * Draws the heading and one row for each line, with the description wrapped
 * to its column, and records every cell as a field. Returns the y of the
 * table's bottom edge.
 */
export function drawTable(
  canvas: Canvas,
  x: number,
  top: number,
  columns: readonly Column[],
  lines: readonly LineFields[],
  look: TableLook,
  statics: Partial<Record<StaticColumn, string>> = {},
): number {
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  const leading = look.size * 1.25;
  const headHeight = look.size + 2 * look.padY + HEAD_HEIGHT_PAD;
  const edges: number[] = [];
  columns.reduce((at, c) => {
    edges.push(at);
    return at + c.width;
  }, x);

  if (look.headFill) {
    canvas.rect(
      { x, y: top, w: width, h: headHeight },
      { fill: look.headFill, lineWidth: 0 },
    );
  }
  const headBase = top + look.padY + look.size * 0.82 + 1;
  columns.forEach((c, i) => {
    const left = edges[i] ?? x;
    const right = c.align === "right";
    canvas.text(
      c.label,
      right ? left + c.width - look.padX : left + look.padX,
      headBase,
      {
        font: look.bold,
        size: look.size - 0.5,
        color: look.headColor,
        align: right ? "right" : "left",
      },
    );
  });
  let y = top + headHeight;
  canvas.line([x, y], [x + width, y], look.rule, 0.8);

  lines.forEach((fields, row) => {
    const descColumn = columns.find((c) => c.id === "description");
    const wrapped = descColumn
      ? canvas.wrap(
          fields.description.text,
          descColumn.width - 2 * look.padX,
          look.font,
          look.size,
        )
      : [];
    const rowHeight = Math.max(1, wrapped.length) * leading + 2 * look.padY;
    if (look.zebra && row % 2 === 1) {
      canvas.rect(
        { x, y, w: width, h: rowHeight },
        { fill: look.zebra, lineWidth: 0 },
      );
    }
    const base = y + look.padY + look.size * 0.82;
    columns.forEach((c, i) => {
      const left = edges[i] ?? x;
      const right = c.align === "right";
      const at = right ? left + c.width - look.padX : left + look.padX;
      const style = {
        font: look.font,
        size: look.size,
        color: BLACK,
        align: right ? ("right" as const) : ("left" as const),
      };
      if (c.id === "no") {
        canvas.text(String(row + 1), at, base, style);
      } else if (isStatic(c.id)) {
        canvas.text(statics[c.id] ?? "", at, base, style);
      } else if (c.id === "description") {
        canvas.mark(
          { ...fields.description, text: wrapped.join("\n") },
          canvas.lines(wrapped, at, base, leading, style),
        );
      } else {
        const field = fields[c.id];
        if (field) canvas.put(field, at, base, style);
      }
    });
    y += rowHeight;
    if (look.rowRule) canvas.line([x, y], [x + width, y], look.rule, 0.4);
  });

  if (look.grid) {
    for (const edge of [...edges, x + width]) {
      canvas.line([edge, top], [edge, y], look.rule, 0.5);
    }
  }
  canvas.line([x, y], [x + width, y], look.rule, 0.8);
  return y;
}
