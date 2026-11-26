import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { Database } from "../../src/database/database.js";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { PoVersionRepository } from "../../src/modules/orders/po-version.repository.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import {
  driftProblems,
  type DriftRules,
  type TableColumn,
} from "../support/column-drift.js";
import { CREATOR, REVISER } from "../support/po-version-orders.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

// Whoever adds a column to SalesOrder or SalesOrderLine (P-50's cancel, P-55's
// source document) classifies it here: copied into the PO version tables, or
// left out with a reason. Until they do, this file fails and says which column.
const ORDER_RULES: DriftRules = {
  label: "SalesOrder",
  copied: [
    "orderDate",
    "shipmentDate",
    "currencyCode",
    "prepaymentPercent",
    // The order's own number, copied under the same name.
    "poVersionNo",
  ],
  leftOut: {
    id: "own key",
    orderNo: "reached through orderId",
    navisionNo: "order-level",
    captureState: "order-level",
    customerNo: "order-level",
    externalDocumentNo: "order-level",
    createdBy: "bookkeeping",
    createdAt: "bookkeeping",
    updatedAt: "bookkeeping",
    version: "edit token",
  },
  own: ["id", "orderId", "supersededAt", "supersededBy", "lineCount"],
};

const LINE_RULES: DriftRules = {
  label: "SalesOrderLine",
  copied: [
    "lineNo",
    "itemNo",
    "description",
    "quantity",
    "unitPrice",
    "qtyToShip",
  ],
  leftOut: { id: "own key", orderId: "reached through orderId" },
  own: ["id", "versionId"],
};

const column = (
  over: Partial<TableColumn> & { name: string },
): TableColumn => ({
  dataType: "integer",
  precision: 32,
  scale: 0,
  nullable: false,
  ...over,
});

describe("the drift comparison", () => {
  const original = [column({ name: "a" }), column({ name: "b" })];
  const rules: DriftRules = {
    label: "T",
    copied: ["a"],
    leftOut: { b: "order-level" },
    own: ["id"],
  };
  const copy = [column({ name: "a" }), column({ name: "id" })];

  it("finds nothing when the columns are classified and alike", () => {
    expect(driftProblems(original, copy, rules)).toEqual([]);
  });

  it("names a column of the original that has no place in the copy and is not named as left out on purpose", () => {
    const problems = driftProblems(
      [...original, column({ name: "fresh" })],
      copy,
      rules,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("column fresh has no place in the copy");
  });

  it("names a copied column whose type, precision or nullability differs, and a reason outside the fixed set", () => {
    const wider = [
      column({ name: "a", precision: 64 }),
      column({ name: "id" }),
    ];
    expect(driftProblems(original, wider, rules)[0]).toContain(
      "a is integer(32,0) not null in the original and integer(64,0) not null in the copy",
    );
    const reasons = { ...rules, leftOut: { b: "because" } };
    expect(driftProblems(original, copy, reasons)[0]).toContain(
      'left out for "because"',
    );
    expect(
      driftProblems([], [], { ...rules, copied: [] }).some((p) =>
        p.includes("nothing was compared"),
      ),
    ).toBe(true);
  });
});

describe("the columns of an order and of its copy cannot drift apart", () => {
  let t: TestContext;
  let db: Database;
  let repo: PoVersionRepository;
  let client: pg.Client;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    repo = new PoVersionRepository(db, new SalesOrderRepository(db));
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await t.close();
    await resetTestData();
  });

  async function columnsOf(table: string): Promise<TableColumn[]> {
    const { rows } = await client.query<{
      column_name: string;
      data_type: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1
        ORDER BY ordinal_position`,
      [table],
    );
    return rows.map((r) => ({
      name: r.column_name,
      dataType: r.data_type,
      precision: r.numeric_precision,
      scale: r.numeric_scale,
      nullable: r.is_nullable === "YES",
    }));
  }

  it("holds for the order and its copy", async () => {
    expect(
      driftProblems(
        await columnsOf("SalesOrder"),
        await columnsOf("SalesOrderPoVersion"),
        ORDER_RULES,
      ),
    ).toEqual([]);
  });

  it("holds for a line and its copy", async () => {
    expect(
      driftProblems(
        await columnsOf("SalesOrderLine"),
        await columnsOf("SalesOrderPoVersionLine"),
        LINE_RULES,
      ),
    ).toEqual([]);
  });

  // The two selects below name every copied column, written out so that a
  // column that exists on both sides but that nobody copies shows as a
  // difference: its default lands in the copy and the head's value does not.
  const HEAD_SQL = `SELECT "orderDate"::text AS "orderDate", "shipmentDate"::text AS "shipmentDate",
            "currencyCode", "prepaymentPercent"::text AS "prepaymentPercent",
            "poVersionNo"
       FROM "SalesOrder" WHERE "id" = $1`;
  const COPY_SQL = `SELECT "orderDate"::text AS "orderDate", "shipmentDate"::text AS "shipmentDate",
            "currencyCode", "prepaymentPercent"::text AS "prepaymentPercent",
            "poVersionNo"
       FROM "SalesOrderPoVersion" WHERE "orderId" = $1`;
  const HEAD_LINES_SQL = `SELECT l."lineNo", l."itemNo", l."description",
            l."quantity"::text AS "quantity", l."unitPrice"::text AS "unitPrice",
            l."qtyToShip"::text AS "qtyToShip"
       FROM "SalesOrderLine" l WHERE l."orderId" = $1 ORDER BY l."lineNo"`;
  const COPY_LINES_SQL = `SELECT l."lineNo", l."itemNo", l."description",
            l."quantity"::text AS "quantity", l."unitPrice"::text AS "unitPrice",
            l."qtyToShip"::text AS "qtyToShip"
       FROM "SalesOrderPoVersionLine" l
       JOIN "SalesOrderPoVersion" v ON v."id" = l."versionId"
      WHERE v."orderId" = $1 ORDER BY l."lineNo"`;

  it("a round trip: every copied column of the order and of its lines comes out of the copy as the head held it", async () => {
    // Every copied column holds its own value, so a swapped source, a dropped
    // field or a default that lands instead is a visible difference.
    const head = await db.client.salesOrder.create({
      data: {
        orderNo: "SO-20261126-0900",
        captureState: "SUBMITTED",
        customerNo: "C-10010",
        externalDocumentNo: "PO-DRIFT",
        orderDate: new Date("2026-10-03"),
        shipmentDate: new Date("2026-10-20"),
        currencyCode: "EUR",
        prepaymentPercent: "37.25",
        createdBy: CREATOR,
        lines: {
          create: [
            {
              lineNo: 1,
              itemNo: "ITM-0001",
              description: "First drift item",
              quantity: "7.125",
              unitPrice: "31.97",
              qtyToShip: "3.5",
            },
            {
              lineNo: 2,
              itemNo: "ITM-0002",
              description: "Second drift item",
              quantity: "2",
              unitPrice: "5.5",
              qtyToShip: "1",
            },
          ],
        },
      },
    });
    const headBefore = (await client.query(HEAD_SQL, [head.id])).rows;
    const linesBefore = (await client.query(HEAD_LINES_SQL, [head.id])).rows;
    expect(Object.keys(headBefore[0] as object).sort()).toEqual(
      [...ORDER_RULES.copied].sort(),
    );
    expect(Object.keys(linesBefore[0] as object).sort()).toEqual(
      [...LINE_RULES.copied].sort(),
    );

    const next = new SalesOrder({
      orderNo: head.orderNo,
      navisionNo: null,
      captureState: "submitted",
      customerNo: "C-10010",
      externalDocumentNo: "PO-DRIFT",
      orderDate: "2026-11-01",
      shipmentDate: null,
      currencyCode: "EUR",
      prepaymentPercent: "90.00",
      createdBy: CREATOR,
      poVersionNo: 2,
      lines: [
        {
          lineNo: 1,
          itemNo: "ITM-0003",
          description: "Replacing item",
          quantity: "1",
          unitPrice: "1.00",
          qtyToShip: "1",
        },
      ],
    });
    expect(
      await db.transaction(() =>
        repo.supersede(next, 1, { userId: REVISER, at: new Date() }),
      ),
    ).toBe(true);

    const copy = (await client.query(COPY_SQL, [head.id])).rows;
    const copiedLines = (await client.query(COPY_LINES_SQL, [head.id])).rows;
    expect(copy).toEqual(headBefore);
    expect(copiedLines).toEqual(linesBefore);
    expect(copiedLines.map((l: { lineNo: number }) => l.lineNo)).toEqual([
      1, 2,
    ]);
  });
});
