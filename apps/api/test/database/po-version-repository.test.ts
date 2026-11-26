import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import {
  SalesOrder,
  type SalesOrderInput,
} from "../../src/modules/orders/domain/sales-order.js";
import { PoVersionRepository } from "../../src/modules/orders/po-version.repository.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";
import { CREATOR, REVISER, storedOrder } from "../support/po-version-orders.js";

const AT = new Date("2026-11-26T03:00:00.000Z");
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A test seam: commits something between the two statements of a stable read. */
class BarrierRepository extends PoVersionRepository {
  hook: (() => Promise<void>) | null = null;
  protected override afterRead(): Promise<void> {
    return this.hook ? this.hook() : Promise.resolve();
  }
}

describe("the PO version repository", () => {
  let t: TestContext;
  let db: Database;
  let repo: BarrierRepository;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    repo = new BarrierRepository(db, new SalesOrderRepository(db));
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  /** The content of the next version, whatever state the stored order is in. */
  function nextOf(
    orderNo: string,
    quantity: string,
    description = "Reworded item",
    over: Partial<SalesOrderInput> = {},
  ): SalesOrder {
    return new SalesOrder({
      orderNo,
      navisionNo: null,
      captureState: "submitted",
      customerNo: "C-10010",
      externalDocumentNo: "PO-NEXT",
      orderDate: "2026-11-20",
      shipmentDate: "2026-12-05",
      currencyCode: "USD",
      prepaymentPercent: "50.00",
      createdBy: CREATOR,
      poVersionNo: 2,
      lines: [
        {
          lineNo: 1,
          itemNo: "ITM-0001",
          description,
          quantity,
          unitPrice: "35.77",
          qtyToShip: quantity,
        },
      ],
      ...over,
    });
  }

  const supersedeAlone = (orderNo: string, expected: number, quantity = "8") =>
    db.transaction(() =>
      repo.supersede(nextOf(orderNo, quantity), expected, {
        userId: REVISER,
        at: AT,
      }),
    );

  async function snapshotOf(orderId: string) {
    const head = await db.client.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    return {
      // The order's own: a revision never moves these.
      customerNo: head.customerNo,
      externalDocumentNo: head.externalDocumentNo,
      currencyCode: head.currencyCode,
      captureState: head.captureState,
      navisionNo: head.navisionNo,
      poVersionNo: head.poVersionNo,
      version: head.version,
      orderDate: head.orderDate.toISOString(),
      prepaymentPercent: head.prepaymentPercent.toFixed(2),
      lines: head.lines.map((l) => [
        l.lineNo,
        l.itemNo,
        l.quantity.toFixed(3),
        l.unitPrice.toFixed(2),
      ]),
      copies: await db.client.salesOrderPoVersion.count({
        where: { orderId },
      }),
      copyLines: await db.client.salesOrderPoVersionLine.count({
        where: { version: { orderId } },
      }),
    };
  }

  it("supersede copies the head at the moment it is superseded and moves the number and the edit token together", async () => {
    const { id, orderNo } = await storedOrder(db);
    expect(await supersedeAlone(orderNo, 1)).toBe(true);
    const copy = await db.client.salesOrderPoVersion.findFirstOrThrow({
      where: { orderId: id },
      include: { lines: { orderBy: { lineNo: "asc" } } },
    });
    expect(copy.poVersionNo).toBe(1);
    expect(copy.orderDate.toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(copy.prepaymentPercent.toFixed(2)).toBe("30.00");
    expect(copy.supersededBy).toBe(REVISER);
    expect(copy.supersededAt).toEqual(AT);
    expect(copy.lines.map((l) => l.unitPrice.toFixed(2))).toEqual([
      "31.97",
      "33.41",
    ]);
    const head = await snapshotOf(id);
    expect(head).toMatchObject({
      poVersionNo: 2,
      version: 2,
      prepaymentPercent: "50.00",
      lines: [[1, "ITM-0001", "8.000", "35.77"]],
    });
  });

  it("supersede leaves the customer, the PO number, the currency, the state and the Business Central number alone", async () => {
    const { id, orderNo } = await storedOrder(db);
    await db.client.salesOrder.update({
      where: { id },
      data: { navisionNo: "SO-BC-0042" },
    });
    const before = await snapshotOf(id);
    // A next order that differs in every one of them: the update must not
    // carry any of them across.
    const different = nextOf(orderNo, "8", "Reworded item", {
      customerNo: "C-10099",
      externalDocumentNo: "PO-OTHER",
      currencyCode: "EUR",
      captureState: "void",
      navisionNo: "SO-BC-9999",
    });
    expect(
      await db.transaction(() =>
        repo.supersede(different, 1, { userId: REVISER, at: AT }),
      ),
    ).toBe(true);
    const after = await snapshotOf(id);
    expect(after).toMatchObject({
      customerNo: before.customerNo,
      externalDocumentNo: before.externalDocumentNo,
      currencyCode: before.currencyCode,
      captureState: before.captureState,
      navisionNo: "SO-BC-0042",
      poVersionNo: 2,
    });
    expect(after.externalDocumentNo).not.toBe("PO-OTHER");
  });

  it("supersede answers false and changes nothing for a stale number, a draft and a void order", async () => {
    const submitted = await storedOrder(db);
    const draft = await storedOrder(db, { captureState: "DRAFT" });
    const closed = await storedOrder(db, { captureState: "VOID" });
    for (const [order, expected] of [
      [submitted, 5],
      [draft, 1],
      [closed, 1],
    ] as const) {
      const before = await snapshotOf(order.id);
      expect(await supersedeAlone(order.orderNo, expected)).toBe(false);
      expect(await snapshotOf(order.id)).toEqual(before);
    }
  });

  it("two guarded supersedes at once: one true, one false", async () => {
    const { id, orderNo } = await storedOrder(db);
    const slowFirst = db.transaction(async () => {
      const done = await repo.supersede(nextOf(orderNo, "8"), 1, {
        userId: REVISER,
        at: AT,
      });
      // Held open, so the second must wait for the row lock and then find
      // that the number it expected is gone.
      await sleep(300);
      return done;
    });
    await sleep(50);
    const second = supersedeAlone(orderNo, 1, "9");
    const results = await Promise.all([slowFirst, second]);
    expect(results.sort()).toEqual([false, true]);
    const after = await snapshotOf(id);
    expect(after.copies).toBe(1);
    expect(after.poVersionNo).toBe(2);
  });

  it("rolls the head, the copy and the lines back when the transaction throws after supersede", async () => {
    const { id, orderNo } = await storedOrder(db);
    const before = await snapshotOf(id);
    await expect(
      db.transaction(async () => {
        await repo.supersede(nextOf(orderNo, "8"), 1, {
          userId: REVISER,
          at: AT,
        });
        throw new Error("the port said no");
      }),
    ).rejects.toThrow("the port said no");
    expect(await snapshotOf(id)).toEqual(before);
  });

  it("a failed insert is rethrown with only the order, the version and the code", async () => {
    const { id, orderNo } = await storedOrder(db);
    const before = await snapshotOf(id);
    // A NUL cannot be stored in text, so the lines fail to write, after the
    // copy and the move, with the prices of the failed call in its arguments.
    const failing = nextOf(orderNo, "8", "bad\u0000text");
    const error = await db
      .transaction(() =>
        repo.supersede(failing, 1, { userId: REVISER, at: AT }),
      )
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(
      new RegExp(
        `^PO version 2 of order ${orderNo} could not be stored \\(\\w+\\)$`,
      ),
    );
    for (const price of ["35.77", "31.97", "33.41"])
      expect(message).not.toContain(price);
    expect((error as Error).cause).toBeUndefined();
    expect(await snapshotOf(id)).toEqual(before);
  });

  it("a Prisma error that quotes the call's arguments, with a price among them, reaches the caller without the price", async () => {
    const { id, orderNo } = await storedOrder(db);
    const before = await snapshotOf(id);
    // A wrong type for one price makes Prisma answer with a validation error
    // that prints the whole call, and the other line's price with it.
    const lines = [
      {
        lineNo: 1,
        itemNo: "ITM-0001",
        description: "Quoted line",
        quantity: "3.000",
        unitPrice: "35.77",
        qtyToShip: "3.000",
      },
      {
        lineNo: 2,
        itemNo: "ITM-0002",
        description: "Wrong type",
        quantity: "1.000",
        unitPrice: "not a price",
        qtyToShip: "1.000",
      },
    ];
    // The control: without the wrapper this very call quotes the price.
    const raw = await db.client.salesOrderLine
      .createMany({ data: lines.map((line) => ({ ...line, orderId: id })) })
      .catch((thrown: unknown) => thrown);
    expect((raw as Error).message).toContain("35.77");

    // The domain would refuse this price before the repository saw it, so the
    // lines are put in after the order is built: the wrapper is for the error
    // nobody foresaw, not for one the domain already catches.
    const failing = nextOf(orderNo, "3");
    Object.defineProperty(failing, "lines", { value: lines });
    const error = await db
      .transaction(() =>
        repo.supersede(failing, 1, { userId: REVISER, at: AT }),
      )
      .catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^PO version 2 of order SO-\d{8}-\d{4} could not be stored \(\w+\)$/,
    );
    expect((error as Error).message).not.toContain("35.77");
    expect((error as Error).cause).toBeUndefined();
    expect(await snapshotOf(id)).toEqual(before);
  });

  it("historyOf gives the versions ascending with who and when from the neighbouring copy, and the order's own createdAt and createdBy for the first", async () => {
    const { id, orderNo } = await storedOrder(db);
    expect(await supersedeAlone(orderNo, 1)).toBe(true);
    const later = new Date("2026-11-27T03:00:00.000Z");
    await db.transaction(() =>
      repo.supersede(nextOf(orderNo, "9"), 2, { userId: CREATOR, at: later }),
    );
    const head = await db.client.salesOrder.findUniqueOrThrow({
      where: { id },
    });
    const history = await repo.historyOf(orderNo);
    expect(history?.captureState).toBe("submitted");
    expect(history?.versions.map((v) => [v.poVersionNo, v.current])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ]);
    const [one, two, three] = history?.versions ?? [];
    expect(one).toMatchObject({
      arrivedAt: head.createdAt,
      arrivedBy: CREATOR,
      supersededAt: AT,
      supersededBy: REVISER,
    });
    expect(two).toMatchObject({
      arrivedAt: AT,
      arrivedBy: REVISER,
      supersededAt: later,
      supersededBy: CREATOR,
    });
    expect(three).toMatchObject({
      arrivedAt: later,
      arrivedBy: CREATOR,
      supersededAt: null,
      supersededBy: null,
    });
    expect(one?.content.lines.map((l) => l.quantity)).toEqual([
      "229.000",
      "4.000",
    ]);
    expect(three?.content.lines.map((l) => l.quantity)).toEqual(["9.000"]);
  });

  it("historyOf and headOf answer null for an unknown number", async () => {
    expect(await repo.historyOf("SO-20261126-9999")).toBeNull();
    expect(await repo.headOf("SO-20261126-9999")).toBeNull();
  });

  it("headOf and historyOf read again when a supersede commits between their statements, and never answer with version 1's header and version 2's lines", async () => {
    for (const read of ["headOf", "historyOf"] as const) {
      const { orderNo } = await storedOrder(db);
      let fired = false;
      repo.hook = async () => {
        if (fired) return;
        fired = true;
        await supersedeAlone(orderNo, 1);
      };
      try {
        const answer = await repo[read](orderNo);
        expect(fired).toBe(true);
        const current =
          answer instanceof SalesOrder
            ? answer
            : answer?.versions.find((v) => v.current);
        expect(current?.poVersionNo).toBe(2);
        const lines =
          current instanceof SalesOrder
            ? current.lines.map((l) => l.quantity)
            : current?.content.lines.map((l) => l.quantity);
        expect(lines).toEqual(["8.000"]);
        const date =
          current instanceof SalesOrder
            ? current.orderDate
            : current?.content.orderDate;
        expect(date).toBe("2026-11-20");
      } finally {
        repo.hook = null;
      }
    }
  });

  it("headOf throws when the number keeps moving", async () => {
    const { orderNo } = await storedOrder(db);
    let at = 1;
    repo.hook = async () => {
      await supersedeAlone(orderNo, at);
      at += 1;
    };
    try {
      await expect(repo.headOf(orderNo)).rejects.toThrow(/kept moving/);
    } finally {
      repo.hook = null;
    }
  });
});
