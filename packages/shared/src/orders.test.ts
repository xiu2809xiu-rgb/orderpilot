import { describe, expect, it } from "vitest";
import {
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
