import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DUPLICATE_ORDER_PATH,
  availableStockResponseSchema,
  createSalesOrderSchema,
  existingOrderOf,
  patchSalesOrderSchema,
  voidSalesOrderSchema,
  salesOrderDetailSchema,
  salesOrderListSchema,
  salesOrderQuerySchema,
} from "./index.js";

const amount = {
  field: "order.amount",
  classification: "internal",
  masked: false,
  value: "125.00",
  reason: null,
} as const;

const row = {
  orderNo: "SO-20261108-0001",
  source: "stored",
  captureState: "draft",
  customerNo: "C-10010",
  customerName: "Synthetic Customer 10",
  externalDocumentNo: "PO-7788",
  orderDate: "2026-11-08",
  shipmentDate: null,
  workflowStatus: null,
  amount,
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
};

describe("the orders query", () => {
  it("takes the defaults and the one stock value", () => {
    const q = salesOrderQuerySchema.parse({ stock: "waiting" });
    expect(q).toMatchObject({ page: 1, pageSize: 25, stock: "waiting" });
  });
  it("refuses stock=true, a bad state, a bad date and a bad sort", () => {
    for (const bad of [
      { stock: "true" },
      { captureState: "approved" },
      { orderDateFrom: "08/11/2026" },
      { sort: "status" },
      { direction: "up" },
      { pageSize: "500" },
      { page: "0" },
      { amountFrom: "12.5.1" },
    ]) {
      expect(
        salesOrderQuerySchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe("the orders responses", () => {
  it("parses a page with no mock flag", () => {
    const page = { data: [row], meta: { page: 1, pageSize: 25, total: 1 } };
    expect(salesOrderListSchema.safeParse(page).success).toBe(true);
  });
  it("parses a detail with a masked line", () => {
    const masked = {
      field: "order.amount",
      classification: "internal",
      masked: true,
      value: null,
      reason: "price",
    };
    const detail = {
      ...row,
      prepaymentPercent: "30",
      navisionNo: null,
      version: null,
      lines: [
        {
          lineNo: 1,
          itemNo: "I-0001",
          description: "Synthetic demo item",
          quantity: "10",
          qtyToShip: "10",
          unitPrice: masked,
          lineAmount: masked,
          shortBy: null,
        },
      ],
    };
    expect(salesOrderDetailSchema.safeParse(detail).success).toBe(true);
  });
  it("refuses an unknown source", () => {
    expect(
      salesOrderListSchema.safeParse({
        data: [{ ...row, source: "imported" }],
        meta: { page: 1, pageSize: 25, total: 1 },
      }).success,
    ).toBe(false);
  });
});

const createBody = {
  customerNo: "C-10010",
  externalDocumentNo: "PO-7788",
  orderDate: "2026-11-09",
  shipmentDate: null,
  prepaymentPercent: "30",
  lines: [{ itemNo: "ITM-0001", quantity: "10", unitPrice: "12.50" }],
};

describe("the order write contract", () => {
  it("accepts a whole order", () => {
    expect(createSalesOrderSchema.safeParse(createBody).success).toBe(true);
  });
  it("refuses a zero quantity, four decimals and a three decimal price", () => {
    const withLine = (line: object) =>
      createSalesOrderSchema.safeParse({
        ...createBody,
        lines: [{ itemNo: "ITM-0001", ...line }],
      }).success;
    expect(withLine({ quantity: "0" })).toBe(false);
    expect(withLine({ quantity: "0.000" })).toBe(false);
    expect(withLine({ quantity: "1.2345" })).toBe(false);
    expect(withLine({ quantity: "1", unitPrice: "1.005" })).toBe(false);
    expect(withLine({ quantity: "0.5", unitPrice: "0" })).toBe(true);
  });
  it("refuses an order with no lines and a bad date", () => {
    expect(
      createSalesOrderSchema.safeParse({ ...createBody, lines: [] }).success,
    ).toBe(false);
    expect(
      createSalesOrderSchema.safeParse({ ...createBody, orderDate: "9/11" })
        .success,
    ).toBe(false);
  });
  it("keeps exactly the keys a patch sends", () => {
    const parsed = patchSalesOrderSchema.parse({
      version: 2,
      prepaymentPercent: "50",
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "prepaymentPercent",
      "version",
    ]);
  });
  it("refuses a patch that sends only the version", () => {
    expect(patchSalesOrderSchema.safeParse({ version: 1 }).success).toBe(false);
  });
  it("needs a reason to void", () => {
    expect(
      voidSalesOrderSchema.safeParse({ version: 1, reason: "  " }).success,
    ).toBe(false);
    expect(
      voidSalesOrderSchema.safeParse({ version: 1, reason: "Typed twice" })
        .success,
    ).toBe(true);
  });
  it("writes every body and the stock answer as OpenAPI output", () => {
    for (const schema of [
      createSalesOrderSchema,
      patchSalesOrderSchema,
      voidSalesOrderSchema,
      availableStockResponseSchema,
    ]) {
      expect(() =>
        z.toJSONSchema(schema, { target: "openapi-3.0", io: "output" }),
      ).not.toThrow();
    }
  });
  it("reads the existing order from a 409's details", () => {
    expect(
      existingOrderOf([
        { path: "externalDocumentNo", message: "Already used" },
        { path: DUPLICATE_ORDER_PATH, message: "SO-20261109-0001" },
      ]),
    ).toBe("SO-20261109-0001");
    expect(existingOrderOf(null)).toBeNull();
    expect(existingOrderOf([{ path: "x", message: "y" }])).toBeNull();
  });
});
