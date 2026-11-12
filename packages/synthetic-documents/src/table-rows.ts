import { BLACK, type Canvas } from "./canvas.js";
import type { LineFields } from "./fields.js";
import type { Column, ColumnId, StaticColumn, TableLook } from "./table.js";

const STATICS: readonly ColumnId[] = ["no", "uom", "discount", "delivery"];
const isStatic = (id: ColumnId): id is StaticColumn => STATICS.includes(id);

const HEAD_HEIGHT_PAD = 2;

/** Where a table's columns sit and how tall its lines are. */
export interface Geometry {
  x: number;
  width: number;
  /** The left edge of each column. */
  edges: number[];
  leading: number;
  headHeight: number;
}

export function geometryOf(
  x: number,
  columns: readonly Column[],
  look: TableLook,
): Geometry {
  const edges: number[] = [];
  columns.reduce((at, c) => {
    edges.push(at);
    return at + c.width;
  }, x);
  return {
    x,
    // Summed on its own, not as a difference of edges, so the rounding is the
    // one every earlier page was drawn with.
    width: columns.reduce((sum, c) => sum + c.width, 0),
    edges,
    leading: look.size * 1.25,
    headHeight: look.size + 2 * look.padY + HEAD_HEIGHT_PAD,
  };
}

/** A row with its description already wrapped, so its height is known before it is drawn. */
export interface MeasuredRow {
  fields: LineFields;
  wrapped: string[];
  height: number;
}

export function measureRows(
  canvas: Canvas,
  columns: readonly Column[],
  lines: readonly LineFields[],
  look: TableLook,
  geo: Geometry,
): MeasuredRow[] {
  const descColumn = columns.find((c) => c.id === "description");
  return lines.map((fields) => {
    const wrapped = descColumn
      ? canvas.wrap(
          fields.description.text,
          descColumn.width - 2 * look.padX,
          look.font,
          look.size,
        )
      : [];
    return {
      fields,
      wrapped,
      height: Math.max(1, wrapped.length) * geo.leading + 2 * look.padY,
    };
  });
}

/** The heading row and the rule under it. Returns the y the rows start at. */
export function drawHeading(
  canvas: Canvas,
  columns: readonly Column[],
  look: TableLook,
  geo: Geometry,
  top: number,
): number {
  const { x, width, edges } = geo;
  if (look.headFill) {
    canvas.rect(
      { x, y: top, w: width, h: geo.headHeight },
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
  const y = top + geo.headHeight;
  canvas.line([x, y], [x + width, y], look.rule, 0.8);
  return y;
}

/**
 * One row at `y`, and the rule under it. `index` counts from the first row of
 * the whole table, so the numbers and the stripes run on across pages.
 */
export function drawRow(
  canvas: Canvas,
  columns: readonly Column[],
  look: TableLook,
  geo: Geometry,
  row: MeasuredRow,
  y: number,
  index: number,
  statics: Partial<Record<StaticColumn, string>> = {},
): void {
  const { x, width, edges } = geo;
  const { fields, wrapped, height } = row;
  if (look.zebra && index % 2 === 1) {
    canvas.rect(
      { x, y, w: width, h: height },
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
      canvas.text(String(index + 1), at, base, style);
    } else if (isStatic(c.id)) {
      canvas.text(statics[c.id] ?? "", at, base, style);
    } else if (c.id === "description") {
      canvas.mark(
        { ...fields.description, text: wrapped.join("\n") },
        canvas.lines(wrapped, at, base, geo.leading, style),
      );
    } else {
      const field = fields[c.id];
      if (field) canvas.put(field, at, base, style);
    }
  });
  if (look.rowRule) {
    canvas.line([x, y + height], [x + width, y + height], look.rule, 0.4);
  }
}

/** The lines between columns, for a table that has them, and the rule at its foot. */
export function drawFoot(
  canvas: Canvas,
  look: TableLook,
  geo: Geometry,
  top: number,
  bottom: number,
): void {
  const { x, width } = geo;
  if (look.grid) {
    for (const edge of [...geo.edges, x + width]) {
      canvas.line([edge, top], [edge, bottom], look.rule, 0.5);
    }
  }
  canvas.line([x, bottom], [x + width, bottom], look.rule, 0.8);
}
