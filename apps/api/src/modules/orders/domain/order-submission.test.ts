import { describe, expect, it } from "vitest";
import { submissionFact } from "./order-submission.js";
import { SalesOrder } from "./sales-order.js";

const order = new SalesOrder({
  orderNo: "SO-20261108-0001",
  navisionNo: null,
  captureState: "draft",
  customerNo: "C-10010",
  externalDocumentNo: "PO-7788",
  orderDate: "2026-11-08",
  shipmentDate: null,
  currencyCode: "USD",
  prepaymentPercent: "30.00",
  createdBy: "00000000-0000-4000-8000-000000000001",
  lines: [
    {
      lineNo: 1,
      itemNo: "I-0001",
      description: "Synthetic demo item",
      quantity: "3",
      unitPrice: "31.97",
      qtyToShip: "3",
    },
  ],
});
const by = {
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic Support",
  role: "SUPPORT",
} as const;
const at = new Date("2026-11-26T03:00:00.000Z");
const request = { ip: "203.0.113.9", traceId: "t-submit" };

describe("submissionFact", () => {
  it("builds the fact from the stored order: number, customer, who, when, total, prepayment percent, PO version 1 and the request", () => {
    expect(submissionFact(order, by, at, request)).toEqual({
      orderNo: "SO-20261108-0001",
      customerNo: "C-10010",
      submittedBy: by,
      submittedAt: at,
      total: "95.91",
      prepaymentPercent: "30.00",
      poVersionNo: 1,
      request,
    });
  });

  it("a draft is at PO version 1, so the first submit hands over 1", () => {
    expect(order.poVersionNo).toBe(1);
    expect(submissionFact(order, by, at, request).poVersionNo).toBe(1);
  });

  it("holds the total as a decimal string and no line, no unit price", () => {
    const fact = submissionFact(order, by, at, request);
    expect(typeof fact.total).toBe("string");
    expect(Object.keys(fact)).not.toContain("lines");
    expect(JSON.stringify(fact)).not.toContain("31.97");
    expect(JSON.stringify(fact)).not.toContain("I-0001");
  });

  it("reads nothing but the order and its arguments", () => {
    const allowed = new Set([
      "orderNo",
      "customerNo",
      "poVersionNo",
      "prepaymentPercent",
      "total",
    ]);
    const read: string[] = [];
    const watched = new Proxy(order, {
      get(target, key) {
        read.push(String(key));
        return Reflect.get(target, key, target) as unknown;
      },
    });
    submissionFact(watched, by, at, request);
    expect(read.filter((key) => !allowed.has(key))).toEqual([]);
  });
});
