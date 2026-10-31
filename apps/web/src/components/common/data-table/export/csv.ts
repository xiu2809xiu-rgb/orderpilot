import type { DataTableColumn, ExportValue } from "../types";

// A cell that starts with one of these is read as a formula by Excel, Sheets
// and LibreOffice (OWASP, "CSV injection"). Tab and carriage return can hide one.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Makes a value safe to open in a spreadsheet. Text that could run as a
 * formula gets a leading apostrophe, which spreadsheets show as plain text.
 * Numbers and booleans are written as they are, so a real -5 stays a number.
 */
export function exportCell(value: ExportValue): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;
  return FORMULA_START.test(value) ? `'${value}` : value;
}

function quote(cell: string | number | boolean): string {
  const text = String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV text for the given columns and rows, with CRLF line ends (RFC 4180). */
export function toCsv<Row>(
  columns: readonly DataTableColumn<Row>[],
  rows: readonly Row[],
): string {
  const exportable = columns.filter((column) => column.exportValue);
  const lines = [
    exportable.map((column) => quote(exportCell(column.header))),
    ...rows.map((row) =>
      exportable.map((column) => quote(exportCell(column.exportValue?.(row)))),
    ),
  ];
  return lines.map((line) => line.join(",")).join("\r\n");
}
