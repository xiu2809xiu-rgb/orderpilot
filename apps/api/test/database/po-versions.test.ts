import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const CREATOR = "00000000-0000-4000-8000-000000000001";

/** A copy ($1 id, $2 order, $3 number, $4 its line count) and a line ($1 id, $2 copy, $3 line number). */
const COPY_SQL = `INSERT INTO "SalesOrderPoVersion"
  ("id", "orderId", "poVersionNo", "orderDate", "currencyCode",
   "prepaymentPercent", "supersededAt", "supersededBy", "lineCount")
  VALUES ($1, $2, $3, '2026-11-08', 'USD', 0, now(), '${CREATOR}', $4)`;
const LINE_SQL = `INSERT INTO "SalesOrderPoVersionLine"
  ("id", "versionId", "lineNo", "itemNo", "description", "quantity",
   "unitPrice", "qtyToShip")
  VALUES ($1, $2, $3, 'ITM-0001', 'Synthetic demo item', 10, 12.50, 10)`;

let sequence = 0;
function nextOrderNo(): string {
  sequence += 1;
  return `SO-20261126-${String(sequence).padStart(4, "0")}`;
}

describe("the PO version tables", () => {
  let t: TestContext;
  let db: Database;
  let client: pg.Client;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await t.close();
    await resetTestData();
  });

  async function newOrder(): Promise<string> {
    const order = await db.client.salesOrder.create({
      data: {
        orderNo: nextOrderNo(),
        customerNo: "C-10010",
        externalDocumentNo: `PO-${String(sequence)}`,
        orderDate: new Date("2026-11-08"),
        createdBy: CREATOR,
        lines: {
          create: [
            {
              lineNo: 1,
              itemNo: "ITM-0001",
              description: "Synthetic demo item",
              quantity: "10",
              unitPrice: "12.50",
              qtyToShip: "10",
            },
          ],
        },
      },
    });
    return order.id;
  }

  /** The statements of a revise move in one transaction, as `supersede` makes them. */
  async function supersedeByHand(
    orderId: string,
    poVersionNo: number,
  ): Promise<{ versionId: string; lineId: string }> {
    const versionId = randomUUID();
    const lineId = randomUUID();
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO "SalesOrderPoVersion"
           ("id", "orderId", "poVersionNo", "orderDate", "currencyCode",
            "prepaymentPercent", "supersededAt", "supersededBy", "lineCount")
         VALUES ($1, $2, $3, '2026-11-08', 'USD', 0, now(), $4, 1)`,
        [versionId, orderId, poVersionNo, CREATOR],
      );
      await client.query(
        `INSERT INTO "SalesOrderPoVersionLine"
           ("id", "versionId", "lineNo", "itemNo", "description", "quantity",
            "unitPrice", "qtyToShip")
         VALUES ($1, $2, 1, 'ITM-0001', 'Synthetic demo item', 10, 12.50, 10)`,
        [lineId, versionId],
      );
      await client.query(
        `UPDATE "SalesOrder" SET "poVersionNo" = "poVersionNo" + 1 WHERE "id" = $1`,
        [orderId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return { versionId, lineId };
  }

  it("accepts a copy and its line together with the head's move", async () => {
    const orderId = await newOrder();
    await supersedeByHand(orderId, 1);
    const head = await db.client.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(head.poVersionNo).toBe(2);
  });

  it("refuses UPDATE of a PO version", async () => {
    const { versionId } = await supersedeByHand(await newOrder(), 1);
    await expect(
      client.query(
        `UPDATE "SalesOrderPoVersion" SET "currencyCode" = 'EUR' WHERE "id" = $1`,
        [versionId],
      ),
    ).rejects.toThrow(/SalesOrderPoVersion is insert-only: UPDATE/);
  });

  it("refuses DELETE of a PO version", async () => {
    const { versionId } = await supersedeByHand(await newOrder(), 1);
    await expect(
      client.query(`DELETE FROM "SalesOrderPoVersion" WHERE "id" = $1`, [
        versionId,
      ]),
    ).rejects.toThrow(/SalesOrderPoVersion is insert-only: DELETE/);
  });

  it("refuses UPDATE of a version line", async () => {
    const { lineId } = await supersedeByHand(await newOrder(), 1);
    await expect(
      client.query(
        `UPDATE "SalesOrderPoVersionLine" SET "quantity" = 99 WHERE "id" = $1`,
        [lineId],
      ),
    ).rejects.toThrow(/SalesOrderPoVersionLine is insert-only: UPDATE/);
  });

  it("refuses DELETE of a version line", async () => {
    const { lineId } = await supersedeByHand(await newOrder(), 1);
    await expect(
      client.query(`DELETE FROM "SalesOrderPoVersionLine" WHERE "id" = $1`, [
        lineId,
      ]),
    ).rejects.toThrow(/SalesOrderPoVersionLine is insert-only: DELETE/);
  });

  it("refuses to delete an order that has a PO version", async () => {
    const orderId = await newOrder();
    await supersedeByHand(orderId, 1);
    await expect(
      client.query(`DELETE FROM "SalesOrder" WHERE "id" = $1`, [orderId]),
    ).rejects.toThrow(
      /violates RESTRICT setting of foreign key constraint "SalesOrderPoVersion_orderId_fkey"/,
    );
  });

  it("refuses a second copy of one PO version of one order", async () => {
    const orderId = await newOrder();
    await supersedeByHand(orderId, 1);
    await expect(supersedeByHand(orderId, 1)).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("refuses a second line number in one copy", async () => {
    const orderId = await newOrder();
    const { versionId } = await supersedeByHand(orderId, 1);
    await expect(
      client.query(
        `INSERT INTO "SalesOrderPoVersionLine"
           ("id", "versionId", "lineNo", "itemNo", "description", "quantity",
            "unitPrice", "qtyToShip")
         VALUES ($1, $2, 1, 'ITM-0002', 'Another item', 1, 1.00, 1)`,
        [randomUUID(), versionId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("refuses poVersionNo 0 on the order and on a copy", async () => {
    const orderId = await newOrder();
    await expect(
      client.query(
        `UPDATE "SalesOrder" SET "poVersionNo" = 0 WHERE "id" = $1`,
        [orderId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      client.query(
        `INSERT INTO "SalesOrderPoVersion"
           ("id", "orderId", "poVersionNo", "orderDate", "currencyCode",
            "prepaymentPercent", "supersededAt", "supersededBy", "lineCount")
         VALUES ($1, $2, 0, '2026-11-08', 'USD', 0, now(), $3, 1)`,
        [randomUUID(), orderId, CREATOR],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("refuses, at commit, a head whose number moves without a copy", async () => {
    const orderId = await newOrder();
    await client.query("BEGIN");
    await client.query(
      `UPDATE "SalesOrder" SET "poVersionNo" = 2 WHERE "id" = $1`,
      [orderId],
    );
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is at PO version 2 but holds 0 earlier copies/,
    );
    const head = await db.client.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(head.poVersionNo).toBe(1);
  });

  it("refuses, at commit, a copy added without the head moving", async () => {
    const orderId = await newOrder();
    const versionId = randomUUID();
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "SalesOrderPoVersion"
         ("id", "orderId", "poVersionNo", "orderDate", "currencyCode",
          "prepaymentPercent", "supersededAt", "supersededBy", "lineCount")
       VALUES ($1, $2, 1, '2026-11-08', 'USD', 0, now(), $3, 1)`,
      [versionId, orderId, CREATOR],
    );
    await client.query(LINE_SQL, [randomUUID(), versionId, 1]);
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is at PO version 1 but holds 1 earlier copies/,
    );
    expect(
      await db.client.salesOrderPoVersion.count({ where: { orderId } }),
    ).toBe(0);
  });

  it("refuses, at commit, a line inserted under an existing copy in a later transaction", async () => {
    const orderId = await newOrder();
    const { versionId } = await supersedeByHand(orderId, 1);
    await client.query("BEGIN");
    await client.query(LINE_SQL, [randomUUID(), versionId, 2]);
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is sealed at 1 lines but holds 2/,
    );
    expect(
      await db.client.salesOrderPoVersionLine.count({ where: { versionId } }),
    ).toBe(1);
  });

  it("refuses, at commit, a copy inserted with fewer lines than its count", async () => {
    const orderId = await newOrder();
    const versionId = randomUUID();
    await client.query("BEGIN");
    await client.query(COPY_SQL, [versionId, orderId, 1, 2]);
    await client.query(LINE_SQL, [randomUUID(), versionId, 1]);
    await client.query(
      `UPDATE "SalesOrder" SET "poVersionNo" = 2 WHERE "id" = $1`,
      [orderId],
    );
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is sealed at 2 lines but holds 1/,
    );
    expect(
      await db.client.salesOrderPoVersion.count({ where: { orderId } }),
    ).toBe(0);
  });

  it("refuses, at commit, a copy inserted with more lines than its count", async () => {
    const orderId = await newOrder();
    const versionId = randomUUID();
    await client.query("BEGIN");
    await client.query(COPY_SQL, [versionId, orderId, 1, 1]);
    await client.query(LINE_SQL, [randomUUID(), versionId, 1]);
    await client.query(LINE_SQL, [randomUUID(), versionId, 2]);
    await client.query(
      `UPDATE "SalesOrder" SET "poVersionNo" = 2 WHERE "id" = $1`,
      [orderId],
    );
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is sealed at 1 lines but holds 2/,
    );
  });

  it("refuses a copy with no line count at all", async () => {
    const orderId = await newOrder();
    await expect(
      client.query(COPY_SQL, [randomUUID(), orderId, 1, 0]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("refuses, at commit, a copy numbered above the head's number minus one while the count matches", async () => {
    const orderId = await newOrder();
    const versionId = randomUUID();
    await client.query("BEGIN");
    await client.query(COPY_SQL, [versionId, orderId, 5, 1]);
    await client.query(LINE_SQL, [randomUUID(), versionId, 1]);
    await client.query(
      `UPDATE "SalesOrder" SET "poVersionNo" = 2 WHERE "id" = $1`,
      [orderId],
    );
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is at PO version 2 but holds 1 earlier copies, the highest 5/,
    );
  });

  it("refuses, at commit, a head moved by two with one copy", async () => {
    const orderId = await newOrder();
    const versionId = randomUUID();
    await client.query("BEGIN");
    await client.query(COPY_SQL, [versionId, orderId, 1, 1]);
    await client.query(LINE_SQL, [randomUUID(), versionId, 1]);
    await client.query(
      `UPDATE "SalesOrder" SET "poVersionNo" = 3 WHERE "id" = $1`,
      [orderId],
    );
    await expect(client.query("COMMIT")).rejects.toThrow(
      /is at PO version 3 but holds 1 earlier copies/,
    );
  });

  it("refuses, at commit, an order inserted at a number above 1 with no copies", async () => {
    await expect(
      db.client.salesOrder.create({
        data: {
          orderNo: nextOrderNo(),
          customerNo: "C-10010",
          externalDocumentNo: `PO-${String(sequence)}`,
          orderDate: new Date("2026-11-08"),
          createdBy: CREATOR,
          poVersionNo: 3,
        },
      }),
    ).rejects.toThrow(/is at PO version 3 but holds 0 earlier copies/);
  });

  // On purpose, and the reason is in ADR 0074 decision 3: the copies live and
  // die with their orders, which TRUNCATE takes too, and the harness empties
  // every table this way (test/support/reset.ts). A trigger stops mistakes,
  // not the owner of the table. This test is here so nobody believes the
  // tables are guarded against it. It runs last because it empties them.
  it("still lets a test harness TRUNCATE the tables", async () => {
    const orderId = await newOrder();
    await supersedeByHand(orderId, 1);
    await client.query(
      `TRUNCATE TABLE "SalesOrderPoVersionLine", "SalesOrderPoVersion", "SalesOrder" CASCADE`,
    );
    expect(await db.client.salesOrderPoVersion.count()).toBe(0);
    expect(await db.client.salesOrderPoVersionLine.count()).toBe(0);
    expect(await db.client.salesOrder.count()).toBe(0);
  });
});
