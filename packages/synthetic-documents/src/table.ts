import type { Canvas, Color } from "./canvas.js";
import type { LineFields } from "./fields.js";
import type { FontId } from "./fonts.js";
import {
  drawFoot,
  drawHeading,
  drawRow,
  geometryOf,
  measureRows,
} from "./table-rows.js";

/** `no`, `uom`, `discount` and `delivery` are printed but are not fields anyone extracts. */
export type StaticColumn = "no" | "uom" | "discount" | "delivery";
export type ColumnId = StaticColumn | keyof LineFields;

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
  const geo = geometryOf(x, columns, look);
  const rows = measureRows(canvas, columns, lines, look, geo);
  let y = drawHeading(canvas, columns, look, geo, top);
  rows.forEach((row, index) => {
    drawRow(canvas, columns, look, geo, row, y, index, statics);
    y += row.height;
  });
  drawFoot(canvas, look, geo, top, y);
  return y;
}
