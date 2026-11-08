import { describe, expect, it } from "vitest";
import { ValidationFailedError } from "../../../common/domain-error.js";
import { SalesOrder, type SalesOrderInput } from "./sales-order.js";

function input(over: Partial<SalesOrderInput> = {}): SalesOrderInput {
  return {
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
        unitPrice: "12.50",
        qtyToShip: "3",
      },
      {
        lineNo: 2,
        itemNo: "I-0002",
        description: "Synthetic demo item",
        quantity: "2",
        unitPrice: "0.10",
        qtyToShip: "2",
      },
    ],
    ...over,
  };
}

describe("SalesOrder", () => {
  it("totals its lines and has no status or stock figure of its own", () => {
    const facts = new SalesOrder(input()).toFacts();
    expect(facts.total).toBe("37.70");
    expect(facts).toMatchObject({
      source: "stored",
      captureState: "draft",
      workflowStatus: null,
      stockShortfall: null,
      navisionNo: null,
    });
  });

  it.each([
    ["a sample number", { orderNo: "SO-0001" }],
    ["another record type", { orderNo: "SPR-20261108-0001" }],
    ["no lines", { lines: [] }],
    ["a prepayment over 100", { prepaymentPercent: "100.01" }],
    ["no PO number", { externalDocumentNo: " " }],
  ])("refuses %s", (_name, over) => {
    expect(() => new SalesOrder(input(over))).toThrow(ValidationFailedError);
  });

  it("refuses a line number used twice and a zero quantity", () => {
    const [first] = input().lines;
    if (!first) throw new Error("fixture");
    expect(
      () => new SalesOrder(input({ lines: [first, { ...first }] })),
    ).toThrow(ValidationFailedError);
    expect(
      () => new SalesOrder(input({ lines: [{ ...first, quantity: "0" }] })),
    ).toThrow(ValidationFailedError);
  });
});
