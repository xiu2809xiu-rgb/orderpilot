import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { OrderConflictError } from "../../src/modules/orders/domain/order-errors.js";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const CREATOR = "00000000-0000-4000-8000-000000000001";

function draft(
  orderNo: string,
  po: string,
  over: { customerNo?: string; lines?: number } = {},
): SalesOrder {
  return new SalesOrder({
    orderNo,
    navisionNo: null,
    captureState: "draft",
    customerNo: over.customerNo ?? "C-10010",
    externalDocumentNo: po,
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "0.00",
    createdBy: CREATOR,
    lines: Array.from({ length: over.lines ?? 2 }, (_, i) => ({
      lineNo: i + 1,
      itemNo: "I-0001",
      description: "Synthetic demo item",
      quantity: "4",
      unitPrice: "12.50",
      qtyToShip: "4",
    })),
  });
}

describe("writing draft orders, against the real database", () => {
  let t: TestContext;
  let db: Database;
  let orders: SalesOrderRepository;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    orders = t.app.get(SalesOrderRepository);
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("starts a stored order at version 1 and bumps it on each save", async () => {
    const stored = await orders.insert(draft("SO-20261110-0001", "PO_1"));
    expect(stored.version).toBe(1);
    const edit = stored.edit({ prepaymentPercent: "30.00" });
    expect(await orders.update(edit, 1)).toBe(true);
    const saved = await orders.findByNo("SO-20261110-0001");
    expect(saved?.version).toBe(2);
    expect(saved?.prepaymentPercent).toBe("30.00");
  });

  it("answers false and changes nothing when the version is stale", async () => {
    const before = await orders.findByNo("SO-20261110-0001");
    if (!before) throw new Error("fixture");
    const edit = before.edit({ prepaymentPercent: "50.00" });
    expect(await orders.update(edit, 1)).toBe(false);
    expect(await orders.markVoid(before.orderNo, 1)).toBe(false);
    const after = await orders.findByNo(before.orderNo);
    expect(after?.version).toBe(before.version);
    expect(after?.prepaymentPercent).toBe("30.00");
    expect(after?.captureState).toBe("draft");
  });

  it("renumbers the lines it replaces", async () => {
    const before = await orders.findByNo("SO-20261110-0001");
    if (!before) throw new Error("fixture");
    const second = before.lines[1];
    if (!second) throw new Error("fixture");
    const one = before.edit({ lines: [{ ...second.toFacts(), lineNo: 1 }] });
    expect(await orders.update(one, before.version)).toBe(true);
    const after = await orders.findByNo(before.orderNo);
    expect(after?.lines.map((l) => l.lineNo)).toEqual([1]);
    expect(await db.client.salesOrderLine.count()).toBe(1);
  });

  it("refuses to change a submitted order, even at the right version", async () => {
    await orders.insert(draft("SO-20261110-0002", "PO-SUB"));
    await db.client.salesOrder.update({
      where: { orderNo: "SO-20261110-0002" },
      data: { captureState: "SUBMITTED" },
    });
    const row = await orders.findByNo("SO-20261110-0002");
    if (!row) throw new Error("fixture");
    const edit = new SalesOrder({
      orderNo: row.orderNo,
      navisionNo: null,
      captureState: "draft",
      customerNo: row.customerNo,
      externalDocumentNo: "PO-CHANGED",
      orderDate: row.orderDate,
      shipmentDate: null,
      currencyCode: "USD",
      prepaymentPercent: "0.00",
      createdBy: CREATOR,
      lines: row.lines.map((l) => l.toFacts()),
    });
    expect(await orders.update(edit, 1)).toBe(false);
    expect(await orders.markVoid(row.orderNo, 1)).toBe(false);
    expect((await orders.findByNo(row.orderNo))?.externalDocumentNo).toBe(
      "PO-SUB",
    );
  });

  describe("finding the live order of a PO number", () => {
    it("treats an underscore as itself, not a wildcard", async () => {
      expect(await orders.findLiveByPo("C-10010", "PO_1")).toBe(
        "SO-20261110-0001",
      );
      expect(await orders.findLiveByPo("C-10010", "POX1")).toBeNull();
      expect(await orders.findLiveByPo("C-10010", "PO%")).toBeNull();
    });

    it("ignores case, and another customer's order", async () => {
      expect(await orders.findLiveByPo("C-10010", "po_1")).toBe(
        "SO-20261110-0001",
      );
      expect(await orders.findLiveByPo("C-10020", "PO_1")).toBeNull();
    });

    it("leaves out the order asked about", async () => {
      expect(
        await orders.findLiveByPo("C-10010", "PO_1", "SO-20261110-0001"),
      ).toBeNull();
    });

    it("does not find a void order, and a void frees the pair", async () => {
      const one = await orders.findByNo("SO-20261110-0001");
      if (!one) throw new Error("fixture");
      expect(await orders.markVoid(one.orderNo, one.version)).toBe(true);
      expect(await orders.findLiveByPo("C-10010", "PO_1")).toBeNull();
      expect((await orders.findByNo(one.orderNo))?.captureState).toBe("void");
      await orders.insert(draft("SO-20261110-0003", "PO_1"));
    });
  });

  describe("submitting a draft", () => {
    it("markSubmitted moves a draft at its version to submitted and bumps the version", async () => {
      await orders.insert(draft("SO-20261110-0010", "PO-SUBMIT-1"));
      expect(await orders.markSubmitted("SO-20261110-0010", 1)).toBe(true);
      const after = await orders.findByNo("SO-20261110-0010");
      expect(after?.captureState).toBe("submitted");
      expect(after?.version).toBe(2);
      expect(after?.lines).toHaveLength(2);
    });

    it("markSubmitted answers false and changes nothing for a stale version, a submitted order and a void order", async () => {
      await orders.insert(draft("SO-20261110-0011", "PO-SUBMIT-2"));
      expect(await orders.markSubmitted("SO-20261110-0011", 7)).toBe(false);
      expect((await orders.findByNo("SO-20261110-0011"))?.version).toBe(1);
      expect((await orders.findByNo("SO-20261110-0011"))?.captureState).toBe(
        "draft",
      );
      // Already submitted (version 2 now): the right version still answers false.
      expect(await orders.markSubmitted("SO-20261110-0010", 2)).toBe(false);
      expect((await orders.findByNo("SO-20261110-0010"))?.version).toBe(2);
      await orders.markVoid("SO-20261110-0011", 1);
      expect(await orders.markSubmitted("SO-20261110-0011", 2)).toBe(false);
      const closed = await orders.findByNo("SO-20261110-0011");
      expect(closed?.captureState).toBe("void");
      expect(closed?.version).toBe(2);
    });

    it("a submitted order still holds its customer and PO pair", async () => {
      await orders.insert(draft("SO-20261110-0012", "PO-SUBMIT-5"));
      expect(await orders.markSubmitted("SO-20261110-0012", 1)).toBe(true);
      expect(await orders.findLiveByPo("C-10010", "po-submit-5")).toBe(
        "SO-20261110-0012",
      );
      await expect(
        orders.insert(draft("SO-20261110-0015", "PO-SUBMIT-5")),
      ).rejects.toBeInstanceOf(OrderConflictError);
    });

    it("rolls the state back when the transaction throws after markSubmitted", async () => {
      await orders.insert(draft("SO-20261110-0013", "PO-SUBMIT-3"));
      await expect(
        db.transaction(async () => {
          expect(await orders.markSubmitted("SO-20261110-0013", 1)).toBe(true);
          throw new Error("the handoff refused");
        }),
      ).rejects.toThrow("the handoff refused");
      const after = await orders.findByNo("SO-20261110-0013");
      expect(after?.captureState).toBe("draft");
      expect(after?.version).toBe(1);
    });

    it("two guarded submits at once: one true, one false", async () => {
      await orders.insert(draft("SO-20261110-0014", "PO-SUBMIT-4"));
      const answers = await Promise.all([
        orders.markSubmitted("SO-20261110-0014", 1),
        orders.markSubmitted("SO-20261110-0014", 1),
      ]);
      expect(answers.filter(Boolean)).toHaveLength(1);
      expect((await orders.findByNo("SO-20261110-0014"))?.version).toBe(2);
    });
  });

  it("refuses an update onto another live order's PO number", async () => {
    await orders.insert(draft("SO-20261110-0004", "PO-OTHER"));
    const second = await orders.findByNo("SO-20261110-0004");
    if (!second) throw new Error("fixture");
    const clash = second.edit({ externalDocumentNo: "po_1" });
    await expect(orders.update(clash, second.version)).rejects.toBeInstanceOf(
      OrderConflictError,
    );
    expect((await orders.findByNo(second.orderNo))?.version).toBe(1);
  });
});
