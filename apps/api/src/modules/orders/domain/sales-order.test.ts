import { describe, expect, it } from "vitest";
import {
  ConflictError,
  DomainError,
  ValidationFailedError,
} from "../../../common/domain-error.js";
import { SHIPMENT_BEFORE_ORDER_MESSAGE } from "@orderpilot/shared";
import {
  SalesOrder,
  type PoVersionContentInput,
  type SalesOrderInput,
} from "./sales-order.js";

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

    it("submits a draft into a copy that is submitted, with the same lines and the same version", () => {
      const order = new SalesOrder(input({ version: 3 }));
      const submitted = order.submitted();
      expect(submitted.captureState).toBe("submitted");
      expect(submitted.isDraft).toBe(false);
      expect(submitted.version).toBe(3);
      expect(submitted.toFacts().lines).toEqual(order.toFacts().lines);
      expect(submitted.total).toBe(order.total);
    });

    it("does not change the order it was called on", () => {
      const order = new SalesOrder(input());
      order.submitted();
      expect(order.captureState).toBe("draft");
      expect(order.isDraft).toBe(true);
    });

    it("refuses to submit a submitted order, saying it is already submitted", () => {
      const order = new SalesOrder(input({ captureState: "submitted" }));
      expect(() => order.submitted()).toThrow(
        new ConflictError("Order SO-20261108-0001 is already submitted."),
      );
      expect(() => {
        order.requireSubmittable();
      }).toThrow(ConflictError);
    });

    it("refuses to submit a void order with the draft rule's words", () => {
      const order = new SalesOrder(input({ captureState: "void" }));
      expect(() => order.submitted()).toThrow(
        new ConflictError(
          "Order SO-20261108-0001 is void, so it cannot be submitted. Only a draft can.",
        ),
      );
    });

    it("refuses a draft whose shipment date is before its order date, on shipmentDate", () => {
      // The constructor lets it load: only an edit or a submit checks the pair.
      const order = new SalesOrder(input({ shipmentDate: "2026-11-01" }));
      try {
        order.submitted();
        throw new Error("did not throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationFailedError);
        expect((error as ValidationFailedError).details).toEqual([
          { path: "shipmentDate", message: SHIPMENT_BEFORE_ORDER_MESSAGE },
        ]);
      }
    });

    it("says the state before the dates", () => {
      const order = new SalesOrder(
        input({ captureState: "submitted", shipmentDate: "2026-11-01" }),
      );
      expect(() => order.submitted()).toThrow(ConflictError);
    });

    it("voids a draft into a copy and leaves the original", () => {
      const order = new SalesOrder(input());
      const closed = order.voided();
      expect(closed.captureState).toBe("void");
      expect(closed.isDraft).toBe(false);
      expect(order.captureState).toBe("draft");
    });
  });

  describe("PO versions", () => {
    const submitted = (over: Partial<SalesOrderInput> = {}) =>
      new SalesOrder(input({ captureState: "submitted", ...over }));
    const content = (
      over: Partial<PoVersionContentInput> = {},
    ): PoVersionContentInput => ({
      orderDate: "2026-11-20",
      shipmentDate: "2026-12-01",
      prepaymentPercent: "50.00",
      lines: [
        {
          lineNo: 1,
          itemNo: "I-0001",
          description: "Synthetic demo item",
          quantity: "8",
          unitPrice: "13.00",
          qtyToShip: "8",
        },
      ],
      ...over,
    });
    const refusal = (call: () => unknown): DomainError => {
      try {
        call();
      } catch (error) {
        if (error instanceof DomainError) return error;
        throw error;
      }
      throw new Error("did not throw");
    };

    it("poVersionNo is 1 unless the input holds one", () => {
      expect(new SalesOrder(input()).poVersionNo).toBe(1);
      expect(new SalesOrder(input({ poVersionNo: 3 })).poVersionNo).toBe(3);
    });

    it("toFacts carries poVersionNo", () => {
      expect(
        new SalesOrder(input({ poVersionNo: 4 })).toFacts().poVersionNo,
      ).toBe(4);
    });

    it("revised() copies the order with the new content, the next PO version and the same version, through the constructor", () => {
      const order = submitted({ version: 5 });
      const next = order.revised(content());
      expect(next.poVersionNo).toBe(2);
      expect(next.version).toBe(5);
      expect(next.orderDate).toBe("2026-11-20");
      expect(next.shipmentDate).toBe("2026-12-01");
      expect(next.prepaymentPercent).toBe("50.00");
      expect(next.lines.map((l) => l.quantity)).toEqual(["8"]);
      // The constructor's rules run: an order with no lines is refused.
      expect(() => order.revised(content({ lines: [] }))).toThrow(
        ValidationFailedError,
      );
    });

    it("does not change the order it was called on", () => {
      const order = submitted();
      order.revised(content());
      expect(order.poVersionNo).toBe(1);
      expect(order.orderDate).toBe("2026-11-08");
      expect(order.lines).toHaveLength(2);
    });

    it("keeps the customer, the PO number, the currency, the Business Central number and the state", () => {
      const order = submitted({ navisionNo: "SO-0042", currencyCode: "USD" });
      const next = order.revised(content());
      expect(next.customerNo).toBe("C-10010");
      expect(next.externalDocumentNo).toBe("PO-7788");
      expect(next.currencyCode).toBe("USD");
      expect(next.navisionNo).toBe("SO-0042");
      expect(next.captureState).toBe("submitted");
      expect(next.createdBy).toBe(order.createdBy);
    });

    it("refuses a draft, with words that say to edit it, and a void order", () => {
      const draft = refusal(() => new SalesOrder(input()).revised(content()));
      expect(draft.code).toBe("CONFLICT");
      expect(draft.message).toBe(
        "Order SO-20261108-0001 is a draft, so edit it. Only a submitted order is revised.",
      );
      expect(draft.details).toEqual([
        { path: "captureState", message: "draft" },
      ]);
      const closed = refusal(() =>
        new SalesOrder(input({ captureState: "void" })).revised(content()),
      );
      expect(closed.message).toBe(
        "Order SO-20261108-0001 is void, so it cannot be revised. Only a submitted order can be.",
      );
      expect(closed.details).toEqual([
        { path: "captureState", message: "void" },
      ]);
    });

    it("refuses another customer on customerNo", () => {
      const error = refusal(() => {
        submitted().requireSameOrder("C-10011", "PO-7788");
      });
      expect(error).toBeInstanceOf(ValidationFailedError);
      expect(error.details?.map((d) => d.path)).toEqual(["customerNo"]);
    });

    it("refuses another PO number once spaces and case are ignored, and allows the same number in another case", () => {
      const order = submitted();
      expect(() => {
        order.requireSameOrder("C-10010", "  po-7788 ");
      }).not.toThrow();
      expect(() => {
        order.requireSameOrder("C-10010", "Po -7788");
      }).toThrow(ValidationFailedError);
      const error = refusal(() => {
        order.requireSameOrder("C-10010", "PO-9999");
      });
      expect(error.details).toEqual([
        {
          path: "externalDocumentNo",
          message:
            "A revised PO keeps the PO number PO-7788. A PO with another number is a new order.",
        },
      ]);
    });

    it("refuses a shipment date before the order date, on shipmentDate", () => {
      const error = refusal(() =>
        submitted().revised(
          content({ orderDate: "2026-11-20", shipmentDate: "2026-11-01" }),
        ),
      );
      expect(error.details).toEqual([
        { path: "shipmentDate", message: SHIPMENT_BEFORE_ORDER_MESSAGE },
      ]);
    });
  });
});
