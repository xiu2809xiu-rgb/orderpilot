import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { OrderNumberAllocator } from "../../src/modules/orders/order-number.allocator.js";
import {
  MAX_STORED_READ,
  SalesOrderRepository,
} from "../../src/modules/orders/sales-order.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const AT = new Date("2026-11-08T02:00:00.000Z");
const CREATOR = "00000000-0000-4000-8000-000000000001";

function draft(orderNo: string, poNo: string): SalesOrder {
  return new SalesOrder({
    orderNo,
    navisionNo: null,
    captureState: "draft",
    customerNo: "C-10010",
    externalDocumentNo: poNo,
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "0.00",
    createdBy: CREATOR,
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Synthetic demo item",
        quantity: "4",
        unitPrice: "12.50",
        qtyToShip: "4",
      },
    ],
  });
}

class Abort extends Error {}

describe("stored orders and their numbers, against the real database", () => {
  let t: TestContext;
  let db: Database;
  let numbers: OrderNumberAllocator;
  let orders: SalesOrderRepository;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    numbers = t.app.get(OrderNumberAllocator);
    orders = t.app.get(SalesOrderRepository);
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("takes the next number and keeps the rows, in one transaction", async () => {
    await db.transaction(async () => {
      const a = await numbers.next(AT);
      const b = await numbers.next(AT);
      await orders.insert(draft(a, "PO-A"));
      await orders.insert(draft(b, "PO-B"));
    });
    const all = await orders.listAll();
    expect(all.map((o) => o.orderNo)).toEqual([
      "SO-20261108-0001",
      "SO-20261108-0002",
    ]);
    const found = await orders.findByNo("SO-20261108-0002");
    expect(found?.lines[0]?.quantity).toBe("4.000");
    expect(found?.lines[0]?.unitPrice).toBe("12.50");
    expect(found?.total).toBe("50.00");
    expect(await orders.countAll()).toBe(2);
  });

  it("answers null for a number nobody holds", async () => {
    expect(await orders.findByNo("SO-20990101-0001")).toBeNull();
  });

  it("rolls the counter back with the order, so a failed order burns no number", async () => {
    const day = new Date("2026-12-01T02:00:00.000Z");
    await expect(
      db.transaction(async () => {
        const n = await numbers.next(day);
        expect(n).toBe("SO-20261201-0001");
        await orders.insert(draft(n, "PO-C"));
        throw new Abort("stop");
      }),
    ).rejects.toBeInstanceOf(Abort);
    expect(await orders.findByNo("SO-20261201-0001")).toBeNull();
    expect(await numbers.next(day)).toBe("SO-20261201-0001");
  });

  it("refuses a repeated number with a conflict", async () => {
    await expect(
      orders.insert(draft("SO-20261108-0001", "PO-D")),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("fails loudly past the read bound instead of cutting the list", async () => {
    expect(MAX_STORED_READ).toBe(2000);
    const rows = Array.from({ length: MAX_STORED_READ - 1 }, (_, i) => ({
      orderNo: `SO-20270101-${String(i + 1).padStart(4, "0")}`,
      customerNo: "C-10010",
      externalDocumentNo: `PO-BULK-${String(i)}`,
      orderDate: new Date("2027-01-01"),
      createdBy: CREATOR,
    }));
    await db.client.salesOrder.createMany({ data: rows });
    // The two orders above and these make one more than the bound.
    expect(await orders.countAll()).toBe(MAX_STORED_READ + 1);
    await expect(orders.listAll()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});
