import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const CREATOR = "00000000-0000-4000-8000-000000000001";

function header(orderNo: string, poNo = "PO-1") {
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

  it("stores an order with two lines, as a draft with no Navision number", async () => {
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

  it("accepts two orders with the same customer and PO number", async () => {
    // The duplicate rule is decided with the write route (P-49), not here.
    await db.client.salesOrder.create({
      data: header("SO-20261108-0005", "PO-DUP"),
    });
    await db.client.salesOrder.create({
      data: header("SO-20261108-0006", "PO-DUP"),
    });
    expect(
      await db.client.salesOrder.count({
        where: { customerNo: "C-10010", externalDocumentNo: "PO-DUP" },
      }),
    ).toBe(2);
  });
});
