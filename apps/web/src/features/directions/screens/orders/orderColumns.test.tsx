import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { amount, loadNamespaces } from "./ordersTestKit";
import { StockCell } from "./OrderFigures";
import { orderColumns } from "./orderColumns";
import type { OrderRow } from "./orderRow";

// What the old Orders list's column tests protected, held to the workspace's
// columns: the export says what the screen says, and the default columns.

beforeAll(loadNamespaces);

const t = () => i18n.getFixedT("en", "directions-orders");

const base: OrderRow = {
  orderNo: "SO-20261108-0001",
  source: "stored",
  captureState: "draft",
  customerNo: "C-0001",
  customerName: "Alpha Traders",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-08",
  shipmentDate: null,
  workflowStatus: null,
  amount: {
    ...amount("1200.00"),
    field: "item.unitPrice",
  } as OrderRow["amount"],
  currencyCode: "USD",
  shortage: {
    itemNo: "I-0004",
    ordered: "1260.000",
    availableStock: "10.000",
    shortBy: "1250.000",
  },
  shortageCount: 3,
  status: null,
  ownerRole: null,
  overdue: null,
  openExceptions: 0,
  toConfirm: false,
  step: null,
};

const columns = () =>
  orderColumns({
    t: t(),
    roleLabel: (role) => role,
    today: "2026-11-14",
    valueHidden: false,
  });

describe("the workspace's columns", () => {
  it("exports the same Stock text as the screen, with grouped numbers and the other items", () => {
    const stock = columns().find((column) => column.id === "stock");
    expect(stock?.exportValue?.(base)).toBe(
      "Short by 1,250 of I-0004 and 2 more items",
    );
    expect(stock?.exportValue?.({ ...base, shortageCount: 1 })).toBe(
      "Short by 1,250 of I-0004",
    );
    expect(stock?.exportValue?.({ ...base, shortage: null })).toBe("");
  });

  it("exports the amount with its currency, and the dots word when it is hidden", () => {
    const value = columns().find((column) => column.id === "amount");
    expect(value?.exportValue?.(base)).toBe("USD 1200.00");
    const hidden = {
      ...base,
      amount: { ...base.amount, masked: true, value: null },
    };
    expect(value?.exportValue?.(hidden)).toBe("Hidden");
  });

  it("starts with the age on its own, the order date, the entry state, the source and the stock under Columns", () => {
    const hiddenIds = columns()
      .filter((column) => column.defaultHidden)
      .map((column) => column.id);
    expect(hiddenIds).toEqual(["age", "stock", "orderDate", "entry", "source"]);
  });

  it("shows the PO number by default, right after the order", () => {
    const shown = columns()
      .filter((column) => !column.defaultHidden)
      .map((column) => column.id);
    expect(shown.slice(0, 3)).toEqual([
      "orderNo",
      "externalDocumentNo",
      "customerName",
    ]);
  });

  it("exports the documents as the screen says them: an open exception, never a difference", () => {
    const docs = columns().find((column) => column.id === "docs");
    expect(docs?.exportValue?.({ ...base, openExceptions: 1 })).toBe(
      "1 open exception",
    );
    expect(
      docs?.exportValue?.({ ...base, openExceptions: 2, toConfirm: true }),
    ).toBe("To confirm; 2 open exceptions");
    expect(docs?.exportValue?.(base)).toBe("");
  });

  it("cannot sort by the amount for a role that may not see it", () => {
    const sortable = (valueHidden: boolean) =>
      orderColumns({
        t: t(),
        roleLabel: (role) => role,
        today: "2026-11-14",
        valueHidden,
      }).find((column) => column.id === "amount")?.sortable;
    expect(sortable(false)).toBe(true);
    expect(sortable(true)).toBe(false);
  });

  it("puts the order first and keeps it from being hidden", () => {
    const [first] = columns();
    expect(first?.id).toBe("orderNo");
    expect(first?.hideable).toBe(false);
  });
});

describe("the Stock cell", () => {
  it("says the quantity, the first item and how many more, in text", () => {
    render(<StockCell row={base} />);
    expect(screen.getByText("Short 1,250")).toBeVisible();
    expect(screen.getByText("I-0004 and 2 more")).toBeVisible();
    expect(
      screen.getByTitle("Short by 1,250 of I-0004 and 2 more items"),
    ).toBeInTheDocument();
  });

  it("says Covered when nothing is short", () => {
    render(<StockCell row={{ ...base, shortage: null, shortageCount: 0 }} />);
    expect(screen.getByText("Covered")).toBeVisible();
  });
});
