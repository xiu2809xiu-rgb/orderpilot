import { addDecimal } from "@orderpilot/shared";
import { Canvas, type Color } from "./canvas.js";
import type { LineFields } from "./fields.js";
import { printMoney, printQuantity } from "./format.js";
import {
  drawFoot,
  drawHeading,
  drawRow,
  geometryOf,
  measureRows,
  type MeasuredRow,
} from "./table-rows.js";
import {
  drawTable,
  type Column,
  type StaticColumn,
  type TableLook,
} from "./table.js";

/** The height kept under the last row of a page for the carried-forward line. */
const CARRY_HEIGHT = 16;
const CARRY_COLOR: Color = [0.4, 0.4, 0.42];

export interface FlowSpec {
  x: number;
  /** Where the heading row starts on the first page. */
  top: number;
  columns: readonly Column[];
  lines: readonly LineFields[];
  look: TableLook;
  statics?: Partial<Record<StaticColumn, string>>;
  /** The lowest y a page's content may reach. */
  floor: number;
  /**
   * How much room the block under the table is assumed to need when the whole
   * order stays on one page. It is the number a layout has always checked, so
   * an order that fits today is drawn exactly as it was.
   */
  closing: number;
  /**
   * How far the block under the table really reaches, to its lowest letter.
   * Only an order that runs onto a second page is judged by it.
   */
  extent: number;
  /** The heading row of a continuation page, and what is drawn above it. */
  next: {
    top: number;
    band: (canvas: Canvas, page: number, pages: number) => void;
  };
  /** A column whose running total is printed at the foot of each page that is followed by another. */
  carry?: keyof LineFields | null;
}

export interface FlowResult {
  /** Where the block under the table starts: under the last row, or on a new page. */
  bottom: number;
  pages: number;
  rowsOnPage: number[];
  /** True when the rows fit but the block under them did not. */
  closingOnNewPage: boolean;
}

interface Plan extends FlowResult {
  rows: MeasuredRow[];
}

function plan(spec: FlowSpec, canvas: Canvas): Plan {
  const geo = geometryOf(spec.x, spec.columns, spec.look);
  const rows = measureRows(canvas, spec.columns, spec.lines, spec.look, geo);
  // Summed in the order a table is drawn, so a close call is decided by the
  // same rounding as the drawing.
  let y = spec.top + geo.headHeight;
  for (const row of rows) y += row.height;
  if (y + spec.closing <= spec.floor) {
    return {
      rows,
      bottom: y,
      pages: 1,
      rowsOnPage: [rows.length],
      closingOnNewPage: false,
    };
  }

  const reserve = spec.carry ? CARRY_HEIGHT : 0;
  const rowsOnPage: number[] = [];
  let count = 0;
  y = spec.top + geo.headHeight;
  rows.forEach((row, i) => {
    // The line carrying the total forward is only needed when more rows follow.
    const room = spec.floor - (i === rows.length - 1 ? 0 : reserve);
    if (y + row.height > room && count > 0) {
      rowsOnPage.push(count);
      count = 0;
      y = spec.next.top + geo.headHeight;
    }
    if (y + row.height > room) {
      throw new RangeError(
        `A row of ${row.height.toFixed(0)} pt does not fit on a page`,
      );
    }
    y += row.height;
    count++;
  });
  rowsOnPage.push(count);
  const closingOnNewPage = y + spec.extent > spec.floor;
  return {
    rows,
    bottom: closingOnNewPage ? spec.next.top : y,
    pages: rowsOnPage.length + (closingOnNewPage ? 1 : 0),
    rowsOnPage,
    closingOnNewPage,
  };
}

/** How many pages a table takes and where it ends, without drawing anything. */
export function planFlow(spec: FlowSpec): FlowResult {
  const { bottom, pages, rowsOnPage, closingOnNewPage } = plan(
    spec,
    new Canvas(),
  );
  return { bottom, pages, rowsOnPage, closingOnNewPage };
}

// A column's running total is printed the way its cells are.
function printed(column: keyof LineFields, sum: string): string {
  if (column === "amount") return printMoney(sum);
  if (column === "quantity") return printQuantity(sum);
  // Weights are printed to one decimal, as their cells and totals are.
  if (column === "grossWeight") return Number(sum).toFixed(1);
  return sum;
}

function carriedForward(
  canvas: Canvas,
  spec: FlowSpec,
  y: number,
  sum: string,
): void {
  const at = spec.columns.findIndex((c) => c.id === spec.carry);
  const column = spec.columns[at];
  const geo = geometryOf(spec.x, spec.columns, spec.look);
  const left = geo.edges[at];
  if (!column || left === undefined || !spec.carry) return;
  const style = {
    font: spec.look.font,
    size: spec.look.size - 0.5,
    color: CARRY_COLOR,
  };
  const base = y + 11;
  canvas.text("Carried forward", left - 4, base, { ...style, align: "right" });
  canvas.text(
    printed(spec.carry, sum),
    left + column.width - spec.look.padX,
    base,
    { ...style, align: "right" },
  );
}

/**
 * Draws a lines table that may run over several pages. A row is never split.
 * A page that more rows follow ends with its running total, and the next page
 * starts with the heading again under a band the layout draws. An order that
 * fits on one page is drawn by `drawTable` itself.
 */
export function drawFlow(canvas: Canvas, spec: FlowSpec): FlowResult {
  const { rows, ...result } = plan(spec, canvas);
  if (result.pages === 1) {
    const bottom = drawTable(
      canvas,
      spec.x,
      spec.top,
      spec.columns,
      spec.lines,
      spec.look,
      spec.statics,
    );
    return { ...result, bottom };
  }

  const geo = geometryOf(spec.x, spec.columns, spec.look);
  let top = spec.top;
  let y = drawHeading(canvas, spec.columns, spec.look, geo, top);
  let index = 0;
  let sum = "0";
  result.rowsOnPage.forEach((count, page) => {
    for (let k = 0; k < count; k++) {
      const row = rows[index];
      if (!row) throw new Error("The plan counts a row that is not there");
      drawRow(
        canvas,
        spec.columns,
        spec.look,
        geo,
        row,
        y,
        index,
        spec.statics,
      );
      y += row.height;
      if (spec.carry) {
        sum = addDecimal(sum, row.fields[spec.carry]?.value ?? "0");
      }
      index++;
    }
    drawFoot(canvas, spec.look, geo, top, y);
    const more = index < rows.length;
    if (!more && !result.closingOnNewPage) return;
    if (more && spec.carry) carriedForward(canvas, spec, y, sum);
    canvas.newPage();
    spec.next.band(canvas, page + 2, result.pages);
    top = spec.next.top;
    if (more) y = drawHeading(canvas, spec.columns, spec.look, geo, top);
  });
  return result;
}
