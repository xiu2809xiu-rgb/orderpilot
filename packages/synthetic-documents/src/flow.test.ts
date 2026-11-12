import { describe, expect, it } from "vitest";
import { BLACK, Canvas, type DrawOp } from "./canvas.js";
import type { LineFields } from "./fields.js";
import { drawFlow, planFlow, type FlowSpec } from "./flow.js";
import { spec } from "./model.js";
import { drawTable, type Column, type TableLook } from "./table.js";

// Sizes picked so every height is an exact number: leading 10, a one-line row
// 20 and the heading 20. The first page's rows start at y 120, so a floor of
// 320 holds exactly ten rows.
const LOOK: TableLook = {
  font: "sans",
  bold: "sansBold",
  size: 8,
  headColor: BLACK,
  rule: BLACK,
  zebra: [0.9, 0.9, 0.9],
  padX: 2,
  padY: 5,
};

const COLUMNS: Column[] = [
  { id: "no", label: "No", width: 20 },
  { id: "partNumber", label: "Part", width: 80 },
  { id: "description", label: "Description", width: 160 },
  { id: "amount", label: "Amount", width: 60, align: "right" },
];

function line(i: number, description = "Widget"): LineFields {
  const at = (key: string, value: string, text = value) =>
    spec(`lines.${key}`, key, "lines", value, text, i);
  return {
    partNumber: at("partNumber", `P-${String(i)}`),
    description: at("description", description),
    quantity: at("quantity", "1"),
    unitPrice: null,
    amount: at("amount", `${String((i + 1) * 10)}.00`),
    cartons: null,
    grossWeight: null,
    vendorItemNo: null,
    netWeight: null,
  };
}

const lines = (n: number, description?: string): LineFields[] =>
  Array.from({ length: n }, (_, i) => line(i, description));

interface Band {
  page: number;
  pages: number;
}

function flowSpec(
  n: number,
  more: Partial<FlowSpec> = {},
  bands: Band[] = [],
): FlowSpec {
  return {
    x: 30,
    top: 100,
    columns: COLUMNS,
    lines: lines(n),
    look: LOOK,
    floor: 320,
    closing: 40,
    extent: 40,
    next: {
      top: 60,
      band: (_canvas, page, pages) => bands.push({ page, pages }),
    },
    ...more,
  };
}

const textsOf = (ops: readonly DrawOp[]): string[] =>
  ops.flatMap((op) => (op.kind === "text" ? [op.text] : []));

describe("planFlow", () => {
  it("keeps a table that fits on one page, with the block under it, as one page", () => {
    // Eight rows end at 280; with 40 for the block that is exactly the floor.
    const plan = planFlow(flowSpec(8));
    expect(plan).toEqual({
      bottom: 280,
      pages: 1,
      rowsOnPage: [8],
      closingOnNewPage: false,
    });
  });

  it("moves only the block to a new page when the rows fit and it does not", () => {
    // Nine rows end at 300: 340 with the block is one point past the floor.
    const plan = planFlow(flowSpec(9));
    expect(plan.rowsOnPage).toEqual([9]);
    expect(plan.closingOnNewPage).toBe(true);
    expect(plan.pages).toBe(2);
    expect(plan.bottom).toBe(60);
  });

  it("judges an order that runs on by the block's real reach, not the one-page number", () => {
    // The one-page rule asks 100 for the block, which nine rows cannot give,
    // but the block really reaches 20: it fits under the nine rows.
    const plan = planFlow(flowSpec(9, { closing: 100, extent: 20 }));
    expect(plan).toMatchObject({ pages: 1, bottom: 300 });
  });

  it("lets the last row end exactly on the floor", () => {
    const ten = planFlow(flowSpec(10, { closing: 100, extent: 0 }));
    expect(ten).toMatchObject({ pages: 1, bottom: 320 });
    const eleven = planFlow(flowSpec(11, { closing: 100, extent: 0 }));
    expect(eleven.rowsOnPage).toEqual([10, 1]);
  });

  it("keeps room for the carried-forward line only on a page that more rows follow", () => {
    const carry = { carry: "amount" } as const;
    // 16 points are kept: nine rows on the first page, eleven on the next.
    expect(planFlow(flowSpec(25, carry)).rowsOnPage).toEqual([9, 11, 5]);
    // The last row needs no such room, so it may take the page's last 20.
    expect(planFlow(flowSpec(21, carry)).rowsOnPage).toEqual([9, 12]);
    expect(planFlow(flowSpec(22, carry)).rowsOnPage).toEqual([9, 11, 2]);
  });

  it("refuses a row taller than a page", () => {
    const tall = Array.from({ length: 300 }, () => "word").join(" ");
    expect(() => planFlow(flowSpec(3, { lines: lines(3, tall) }))).toThrow(
      RangeError,
    );
  });
});

describe("drawFlow", () => {
  it("draws a table that fits with the very same marks as drawTable", () => {
    const direct = new Canvas();
    const bottom = drawTable(direct, 30, 100, COLUMNS, lines(8), LOOK);
    const flowed = new Canvas();
    const result = drawFlow(flowed, flowSpec(8));
    expect(result.bottom).toBe(bottom);
    expect(flowed.pages).toEqual(direct.pages);
    expect(flowed.fields).toEqual(direct.fields);
  });

  it("agrees with its own plan on every length", () => {
    for (let n = 1; n <= 60; n++) {
      for (const carry of [null, "amount"] as const) {
        const given = flowSpec(n, { carry });
        const drawing = new Canvas();
        const result = drawFlow(drawing, given);
        expect(result, `${String(n)} rows`).toEqual(planFlow(given));
        expect(drawing.pages).toHaveLength(result.pages);
      }
    }
  });

  it("never lets a row cross the floor, and keeps every row whole", () => {
    for (let n = 1; n <= 60; n++) {
      const drawing = new Canvas();
      drawFlow(drawing, flowSpec(n, { carry: "amount" }));
      const rows = drawing.fields.filter((f) => f.key === "lines.description");
      expect(rows.map((f) => f.lineIndex)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
      for (const f of rows) {
        expect(f.box.y + f.box.h, `row ${String(f.lineIndex)}`).toBeLessThan(
          320,
        );
      }
    }
  });

  it("puts each field on the page its row is drawn on, with the line index running on", () => {
    const drawing = new Canvas();
    const result = drawFlow(drawing, flowSpec(25, { carry: "amount" }));
    const pages = drawing.fields
      .filter((f) => f.key === "lines.partNumber")
      .map((f) => f.page);
    expect(result.rowsOnPage).toEqual([9, 11, 5]);
    expect(pages).toEqual([
      ...Array<number>(9).fill(1),
      ...Array<number>(11).fill(2),
      ...Array<number>(5).fill(3),
    ]);
    expect(drawing.fields.at(-1)?.lineIndex).toBe(24);
  });

  it("repeats the heading and numbers the rows straight through", () => {
    const drawing = new Canvas();
    drawFlow(drawing, flowSpec(25, { carry: "amount" }));
    expect(drawing.pages.map((ops) => textsOf(ops).includes("Part"))).toEqual([
      true,
      true,
      true,
    ]);
    const numbers = drawing.pages
      .flatMap((ops) => textsOf(ops))
      .filter((t) => /^\d+$/.test(t))
      // Part numbers carry a letter, and quantities are not drawn here.
      .map(Number);
    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("stripes by the row's place in the whole table, not in its page", () => {
    const drawing = new Canvas();
    drawFlow(drawing, flowSpec(25, { carry: "amount" }));
    const stripes = drawing.pages
      .flat()
      .filter((op) => op.kind === "rect" && op.fill?.[0] === 0.9);
    expect(stripes).toHaveLength(12);
  });

  it("carries the running total to the next page", () => {
    const drawing = new Canvas();
    drawFlow(drawing, flowSpec(25, { carry: "amount" }));
    const carried: string[] = [];
    for (const ops of drawing.pages) {
      ops.forEach((op, i) => {
        const next = ops[i + 1];
        if (op.kind === "text" && op.text === "Carried forward") {
          if (next?.kind !== "text")
            throw new Error("No total after the label");
          carried.push(next.text);
        }
      });
    }
    // Rows are worth 10, 20, 30, ...: nine of them 450, then twenty 2,100.
    expect(carried).toEqual(["450.00", "2,100.00"]);
  });

  it("calls the band of each continuation page, with the page and the total", () => {
    const bands: Band[] = [];
    drawFlow(new Canvas(), flowSpec(25, { carry: "amount" }, bands));
    expect(bands).toEqual([
      { page: 2, pages: 3 },
      { page: 3, pages: 3 },
    ]);
  });

  it("draws the block on a page of its own, with no heading, when only it moves", () => {
    const bands: Band[] = [];
    const drawing = new Canvas();
    const result = drawFlow(drawing, flowSpec(9, {}, bands));
    expect(result).toMatchObject({
      pages: 2,
      closingOnNewPage: true,
      bottom: 60,
    });
    expect(bands).toEqual([{ page: 2, pages: 2 }]);
    expect(textsOf(drawing.pages[1] ?? [])).not.toContain("Part");
  });
});
