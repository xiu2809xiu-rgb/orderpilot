import { describe, expect, it } from "vitest";
import {
  contentOf,
  contentTotal,
  padDecimal,
  type PoVersionContent,
} from "./po-version-content.js";
import { SalesOrder } from "./sales-order.js";

describe("padDecimal", () => {
  it("pads quantities to three decimals and prices and the percent to two and never rounds", () => {
    expect(padDecimal("5", 3)).toBe("5.000");
    expect(padDecimal("12.5", 2)).toBe("12.50");
    expect(padDecimal("0.125", 3)).toBe("0.125");
    // Trailing zeros past the places are the same number, not a rounding.
    expect(padDecimal("5.1000", 2)).toBe("5.10");
    expect(() => padDecimal("5.125", 2)).toThrow(RangeError);
  });

  it("gives what the database gives back for 007, 0.5, 5.10 and 030 and 0", () => {
    expect(padDecimal("007", 3)).toBe("7.000");
    expect(padDecimal("0.5", 3)).toBe("0.500");
    expect(padDecimal("5.10", 2)).toBe("5.10");
    expect(padDecimal("030", 2)).toBe("30.00");
    expect(padDecimal("0", 2)).toBe("0.00");
    expect(padDecimal("000.50", 2)).toBe("0.50");
  });
});

const order = new SalesOrder({
  orderNo: "SO-20261108-0001",
  navisionNo: null,
  captureState: "submitted",
  customerNo: "C-10010",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-08",
  shipmentDate: "2026-12-01",
  currencyCode: "EUR",
  prepaymentPercent: "30",
  createdBy: "00000000-0000-4000-8000-000000000001",
  lines: [
    {
      lineNo: 1,
      itemNo: "I-0001",
      description: "First item",
      quantity: "7",
      unitPrice: "31.97",
      qtyToShip: "3.5",
    },
    {
      lineNo: 2,
      itemNo: "I-0002",
      description: "Second item",
      quantity: "0.5",
      unitPrice: "5",
      qtyToShip: "0.5",
    },
  ],
});

describe("contentOf", () => {
  it("contentOf an order holds its dates, currency, percent and padded lines", () => {
    expect(contentOf(order)).toEqual({
      orderDate: "2026-11-08",
      shipmentDate: "2026-12-01",
      currencyCode: "EUR",
      prepaymentPercent: "30.00",
      lines: [
        {
          lineNo: 1,
          itemNo: "I-0001",
          description: "First item",
          quantity: "7.000",
          unitPrice: "31.97",
          qtyToShip: "3.500",
        },
        {
          lineNo: 2,
          itemNo: "I-0002",
          description: "Second item",
          quantity: "0.500",
          unitPrice: "5.00",
          qtyToShip: "0.500",
        },
      ],
    });
  });
});

describe("contentTotal", () => {
  it("the total of a copy equals new SalesOrder(copy).total, to the cent, with prices that round per line", () => {
    // Each line is rounded to the cent and the sum of the rounded lines is not
    // the rounded sum of the exact lines, so a second formula would disagree.
    const lines = [1, 2, 3].map((lineNo) => ({
      lineNo,
      itemNo: `I-000${String(lineNo)}`,
      description: "Item",
      quantity: "1.500",
      unitPrice: "0.33",
      qtyToShip: "1.500",
    }));
    const content: PoVersionContent = {
      orderDate: "2026-11-08",
      shipmentDate: null,
      currencyCode: "USD",
      prepaymentPercent: "0.00",
      lines,
    };
    const whole = new SalesOrder({
      orderNo: "SO-20261108-0001",
      navisionNo: null,
      captureState: "submitted",
      customerNo: "C-10010",
      externalDocumentNo: "PO-1",
      createdBy: "00000000-0000-4000-8000-000000000001",
      ...content,
    });
    expect(contentTotal(content)).toBe(whole.total);
    // 1.5 x 0.33 is 0.495, which is 0.50 per line: three lines are 1.50, where
    // the exact sum 1.485 would round to 1.49.
    expect(contentTotal(content)).toBe("1.50");
    expect(contentTotal(contentOf(order))).toBe(order.total);
  });
});
