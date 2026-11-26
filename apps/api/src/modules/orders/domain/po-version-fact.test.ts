import { describe, expect, it } from "vitest";
import { poVersionFact } from "./po-version-fact.js";
import { SalesOrder, type SalesOrderInput } from "./sales-order.js";

const base: SalesOrderInput = {
  orderNo: "SO-20261108-0001",
  navisionNo: null,
  captureState: "submitted",
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
};
const stored = new SalesOrder(base);
const revised = stored.revised({
  orderDate: "2026-11-20",
  shipmentDate: null,
  prepaymentPercent: "50.00",
  lines: [
    {
      lineNo: 1,
      itemNo: "I-0001",
      description: "Synthetic demo item",
      quantity: "4",
      unitPrice: "33.41",
      qtyToShip: "4",
    },
  ],
});
const by = {
  userId: "00000000-0000-4000-8000-000000000002",
  name: "Synthetic Support",
  role: "SUPPORT",
} as const;
const at = new Date("2026-11-26T03:00:00.000Z");
const request = { ip: "203.0.113.9", traceId: "t-revise" };

describe("poVersionFact", () => {
  it("builds the fact: order number, the next number, the number it supersedes, who, when, the new total, the percent and the request", () => {
    expect(poVersionFact(stored, revised, by, at, request)).toEqual({
      orderNo: "SO-20261108-0001",
      poVersionNo: 2,
      supersedesPoVersionNo: 1,
      confirmedBy: by,
      confirmedAt: at,
      total: "133.64",
      prepaymentPercent: "50.00",
      request,
    });
  });

  it("holds the total as a decimal string and no line, no unit price and no customer", () => {
    const fact = poVersionFact(stored, revised, by, at, request);
    expect(typeof fact.total).toBe("string");
    const text = JSON.stringify(fact);
    expect(text).not.toContain("33.41");
    expect(text).not.toContain("I-0001");
    expect(text).not.toContain("C-10010");
    expect(text).not.toContain("PO-7788");
  });

  it("reads nothing but the two orders and its arguments", () => {
    const allowed = new Set([
      "orderNo",
      "poVersionNo",
      "total",
      "prepaymentPercent",
    ]);
    const read: string[] = [];
    const watch = (order: SalesOrder): SalesOrder =>
      new Proxy(order, {
        get(target, key) {
          read.push(String(key));
          return Reflect.get(target, key, target) as unknown;
        },
      });
    poVersionFact(watch(stored), watch(revised), by, at, request);
    expect(read.filter((key) => !allowed.has(key))).toEqual([]);
  });
});
