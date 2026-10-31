import type { DataTableColumn } from "../types";
import { exportCell } from "./csv";

/**
 * An .xlsx file as bytes. ExcelJS is large, so it is imported here, when
 * someone asks for Excel, and not at start-up: it stays out of the entry
 * bundle (ADR 0023).
 */
export async function toXlsx<Row>(
  columns: readonly DataTableColumn<Row>[],
  rows: readonly Row[],
  sheetName: string,
): Promise<ArrayBuffer> {
  const { Workbook } = await import("exceljs");
  const exportable = columns.filter((column) => column.exportValue);
  const workbook = new Workbook();
  // Sheet names may not hold : \ / ? * [ ] and stop at 31 characters.
  const sheet = workbook.addWorksheet(
    sheetName.replaceAll(/[:\\/?*[\]]/g, " ").slice(0, 31),
  );
  sheet.addRow(exportable.map((column) => exportCell(column.header)));
  for (const row of rows) {
    sheet.addRow(
      exportable.map((column) => exportCell(column.exportValue?.(row))),
    );
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
}
