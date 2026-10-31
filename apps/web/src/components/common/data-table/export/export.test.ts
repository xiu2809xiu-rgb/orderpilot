import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { DataTableColumn } from "../types";
import { exportCell, toCsv } from "./csv";
import { toXlsx } from "./excel";

interface Row {
  name: string;
  amount: number | null;
}
const columns: DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "Name",
    cell: (r) => r.name,
    exportValue: (r) => r.name,
  },
  {
    id: "amount",
    header: "Amount",
    cell: (r) => r.amount,
    exportValue: (r) => r.amount,
  },
  { id: "actions", header: "Actions", cell: () => null },
];

describe("exportCell (spreadsheet formula injection)", () => {
  it.each(["=1+1", "+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralises %j",
    (value) => {
      expect(exportCell(value)).toBe(`'${value}`);
    },
  );

  it("leaves safe text, numbers and booleans alone", () => {
    expect(exportCell("Order 1")).toBe("Order 1");
    expect(exportCell("a=b")).toBe("a=b");
    expect(exportCell(-5)).toBe(-5);
    expect(exportCell(true)).toBe(true);
    expect(exportCell(null)).toBe("");
    expect(exportCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("writes a header, quotes commas, quotes and line breaks, and skips columns without an export value", () => {
    const csv = toCsv(columns, [
      { name: 'Smith, "Jo"', amount: 4.5 },
      { name: "Line\nbreak", amount: null },
    ]);
    expect(csv).toBe(
      ["Name,Amount", '"Smith, ""Jo""",4.5', '"Line\nbreak",'].join("\r\n"),
    );
  });

  it("neutralises a formula in a cell, even inside quotes", () => {
    const csv = toCsv(columns, [
      { name: '=HYPERLINK("http://x","y")', amount: -3 },
    ]);
    expect(csv.split("\r\n")[1]).toBe(`"'=HYPERLINK(""http://x"",""y"")",-3`);
  });
});

describe("toXlsx", () => {
  it("builds a workbook that reads back, with formulas stored as text", async () => {
    const bytes = await toXlsx(
      columns,
      [
        { name: "=1+1", amount: -3 },
        { name: "Plain", amount: 7 },
      ],
      "Orders: all/any",
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const sheet = book.worksheets[0];
    expect(sheet?.name).toBe("Orders  all any");
    expect(sheet?.getRow(1).values).toEqual([undefined, "Name", "Amount"]);
    expect(sheet?.getCell("A2").value).toBe("'=1+1");
    expect(sheet?.getCell("B2").value).toBe(-3);
    expect(sheet?.getCell("A3").value).toBe("Plain");
  });

  it("neutralises formula-like headers", async () => {
    const bytes = await toXlsx(
      [
        {
          id: "name",
          header: "=HYPERLINK(1)",
          cell: (r: Row) => r.name,
          exportValue: (r: Row) => r.name,
        },
      ],
      [],
      "Sheet",
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    expect(book.worksheets[0]?.getCell("A1").value).toBe("'=HYPERLINK(1)");
  });
});
