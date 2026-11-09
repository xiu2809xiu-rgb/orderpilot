import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const CREATOR = "00000000-0000-4000-8000-000000000001";

function header(orderNo: string, poNo = orderNo) {
  return {
    orderNo,
    customerNo: "C-10010",
    externalDocumentNo: poNo,
    orderDate: new Date("2026-11-08"),
    createdBy: CREATOR,
  };
}

function line(lineNo: number) {
  return {
    lineNo,
    itemNo: "ITM-0001",
    description: "Synthetic demo item",
    quantity: "10",
    unitPrice: "12.50",
    qtyToShip: "10",
  };
}

describe("the sales order tables", () => {
  let t: TestContext;
  let db: Database;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("stores an order with two lines, as a draft with no Business Central number", async () => {
    const order = await db.client.salesOrder.create({
      data: {
        ...header("SO-20261108-0001"),
        lines: { create: [line(1), line(2)] },
      },
      include: { lines: true },
    });
    expect(order.captureState).toBe("DRAFT");
    expect(order.navisionNo).toBeNull();
    expect(order.currencyCode).toBe("USD");
    expect(order.lines).toHaveLength(2);
  });

  it("removes the lines with their order", async () => {
    const order = await db.client.salesOrder.create({
      data: { ...header("SO-20261108-0002"), lines: { create: [line(1)] } },
    });
    await db.client.salesOrder.delete({ where: { id: order.id } });
    expect(
      await db.client.salesOrderLine.count({ where: { orderId: order.id } }),
    ).toBe(0);
  });

  it("refuses a second line with the same number on one order", async () => {
    const order = await db.client.salesOrder.create({
      data: { ...header("SO-20261108-0003"), lines: { create: [line(1)] } },
    });
    await expect(
      db.client.salesOrderLine.create({
        data: { ...line(1), orderId: order.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("refuses a repeated order number", async () => {
    await db.client.salesOrder.create({ data: header("SO-20261108-0004") });
    await expect(
      db.client.salesOrder.create({ data: header("SO-20261108-0004") }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  describe("one live order per customer and PO number", () => {
    const make = (orderNo: string, po: string, extra = {}) =>
      db.client.salesOrder.create({
        data: { ...header(orderNo, po), ...extra },
      });

    it("refuses the same customer and PO number twice", async () => {
      await make("SO-20261108-0005", "PO-DUP");
      await expect(make("SO-20261108-0006", "PO-DUP")).rejects.toMatchObject({
        code: "P2002",
      });
    });

    it("refuses a PO number that differs only in case", async () => {
      await make("SO-20261108-0007", "PO-Case");
      await expect(make("SO-20261108-0008", "po-case")).rejects.toMatchObject({
        code: "P2002",
      });
    });

    it("allows the same PO number for another customer", async () => {
      await make("SO-20261108-0009", "PO-SHARED");
      await db.client.salesOrder.create({
        data: {
          ...header("SO-20261108-0010", "PO-SHARED"),
          customerNo: "C-10011",
        },
      });
      expect(
        await db.client.salesOrder.count({
          where: { externalDocumentNo: "PO-SHARED" },
        }),
      ).toBe(2);
    });

    it("frees the pair when the order is void", async () => {
      const first = await make("SO-20261108-0011", "PO-FREE");
      await db.client.salesOrder.update({
        where: { id: first.id },
        data: { captureState: "VOID" },
      });
      await make("SO-20261108-0012", "PO-FREE");
      await expect(make("SO-20261108-0013", "PO-FREE")).rejects.toMatchObject({
        code: "P2002",
      });
    });

    it("allows any number of void orders with one pair", async () => {
      await make("SO-20261108-0014", "PO-VOIDS", { captureState: "VOID" });
      await make("SO-20261108-0015", "PO-VOIDS", { captureState: "VOID" });
      expect(
        await db.client.salesOrder.count({
          where: { externalDocumentNo: "PO-VOIDS" },
        }),
      ).toBe(2);
    });

    it("starts every order at version 1", async () => {
      const order = await make("SO-20261108-0016", "PO-VERSION");
      expect(order.version).toBe(1);
    });

    it("holds the rule as a partial unique index in the database", async () => {
      // Prisma cannot declare this index, so a later migrate dev could drop it.
      const rows = await db.client.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'SalesOrder'
          AND indexname = 'SalesOrder_live_customer_po_key'`;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.indexdef).toContain("UNIQUE");
      expect(rows[0]?.indexdef).toContain("upper(");
      expect(rows[0]?.indexdef).toContain("WHERE");
      expect(rows[0]?.indexdef).toContain("VOID");
    });
  });
});
