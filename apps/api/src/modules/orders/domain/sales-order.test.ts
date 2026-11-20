import { describe, expect, it } from "vitest";
import {
  ConflictError,
  ValidationFailedError,
} from "../../../common/domain-error.js";
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

  it("refuses lines whose total is not a decimal string, at lines", () => {
    const big = (lineNo: number) => ({
      lineNo,
      itemNo: "I-0001",
      description: "Synthetic demo item",
      quantity: "1",
      unitPrice: "999999999999999",
      qtyToShip: "1",
    });
    try {
      new SalesOrder(input({ lines: [big(1), big(2)] }));
      throw new Error("did not throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailedError);
      expect((error as ValidationFailedError).details).toEqual([
        { path: "lines", message: expect.any(String) as string },
      ]);
    }
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

  describe("drafts", () => {
    it("starts at version 1 and reports whether it is a draft", () => {
      const order = new SalesOrder(input());
      expect(order.version).toBe(1);
      expect(order.isDraft).toBe(true);
      expect(new SalesOrder(input({ version: 4 })).toFacts().version).toBe(4);
    });

    it("edits only what was sent and keeps the rest", () => {
      const order = new SalesOrder(input());
      const edited = order.edit({
        externalDocumentNo: "PO-1",
        shipmentDate: undefined,
      });
      expect(edited.externalDocumentNo).toBe("PO-1");
      expect(edited.prepaymentPercent).toBe("30.00");
      expect(edited.orderNo).toBe(order.orderNo);
      expect(edited.createdBy).toBe(order.createdBy);
    });

    it("runs every rule again on an edit", () => {
      const order = new SalesOrder(input());
      expect(() => order.edit({ prepaymentPercent: "101" })).toThrow(
        ValidationFailedError,
      );
      expect(() => order.edit({ lines: [] })).toThrow(ValidationFailedError);
    });

    it("refuses a change that puts the shipment before the order date", () => {
      const order = new SalesOrder(input({ shipmentDate: "2026-11-20" }));
      expect(() => order.edit({ shipmentDate: "2026-11-01" })).toThrow(
        ValidationFailedError,
      );
      // One date sent meets the stored other.
      expect(() => order.edit({ orderDate: "2026-11-25" })).toThrow(
        ValidationFailedError,
      );
      expect(order.edit({ shipmentDate: "2026-11-08" }).shipmentDate).toBe(
        "2026-11-08",
      );
    });

    it("loads an order stored before the rule, and edits what is not a date", () => {
      const old = new SalesOrder(input({ shipmentDate: "2020-01-01" }));
      expect(old.edit({ prepaymentPercent: "50" }).prepaymentPercent).toBe(
        "50",
      );
    });

    it.each(["submitted", "void"] as const)(
      "refuses to edit or void a %s order",
      (captureState) => {
        const order = new SalesOrder(input({ captureState }));
        expect(() => order.edit({ externalDocumentNo: "PO-2" })).toThrow(
          ConflictError,
        );
        expect(() => order.voided()).toThrow(ConflictError);
      },
    );

    it("voids a draft into a copy and leaves the original", () => {
      const order = new SalesOrder(input());
      const closed = order.voided();
      expect(closed.captureState).toBe("void");
      expect(closed.isDraft).toBe(false);
      expect(order.captureState).toBe("draft");
    });
  });
});
