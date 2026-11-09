import {
  ROLES,
  itemResponseSchema,
  salesOrderListSchema,
  salesOrderResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const O = `${API}/orders`;
const CREATOR = "00000000-0000-4000-8000-000000000001";
const STORED_DRAFT = "SO-20261108-0001";
const STORED_VOID = "SO-20261108-0002";

describe("the orders routes", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  const dataset = syntheticDataset();
  const customer = dataset.customers[0];
  const item = dataset.items[0];
  if (!customer || !item) throw new Error("the set is empty");

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });
  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };
  const get = (role: Role, path: string) => call(t, as(role), "get", path);
  const list = async (role: Role, query = "") =>
    salesOrderListSchema.parse((await get(role, `${O}?${query}`)).body);
  const numbersOf = (rows: readonly { orderNo: string }[]) =>
    rows.map((row) => row.orderNo);

  const store = (orderNo: string, patch: { captureState: "draft" | "void" }) =>
    t.app.get(SalesOrderRepository, { strict: false }).insert(
      new SalesOrder({
        orderNo,
        navisionNo: null,
        captureState: patch.captureState,
        customerNo: customer.no,
        externalDocumentNo: `PO-${orderNo.slice(-4)}`,
        orderDate: "2026-11-08",
        shipmentDate: null,
        currencyCode: "USD",
        prepaymentPercent: "0.00",
        createdBy: CREATOR,
        lines: [
          {
            lineNo: 1,
            itemNo: item.no,
            description: item.description,
            // More than any item holds, so the order is short.
            quantity: "99999",
            unitPrice: "12.50",
            qtyToShip: "99999",
          },
        ],
      }),
    );

  const waitingSamples = dataset.orders
    .filter((order) => {
      if (!order.stockShortfall) return false;
      const spr = dataset.sprs.find((s) => s.orderNo === order.header.no);
      return spr?.status !== "approved";
    })
    .map((order) => order.header.no);

  it("answers 401 with no session on both routes", async () => {
    for (const route of [O, `${O}/SO-0001`]) {
      expect((await call(t, null, "get", route)).status).toBe(401);
    }
  });

  it("answers 403 without orders.read, and 200 with it", async () => {
    for (const route of [O, `${O}/SO-0001`]) {
      expect((await get("SYSTEM_ADMIN", route)).status).toBe(403);
      expect((await get("WAREHOUSE", route)).status).toBe(200);
    }
  });

  it("answers an unknown number with the standard 404 envelope", async () => {
    for (const no of ["NOPE-1", "SO-9999", "SO-20990101-0001"]) {
      const res = await get("SUPPORT", `${O}/${no}`);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  });

  it("refuses bad input with the validation envelope", async () => {
    for (const path of [
      `${O}?pageSize=500`,
      `${O}?page=0`,
      `${O}?sort=cost`,
      `${O}?direction=sideways`,
      `${O}?stock=true`,
      `${O}?captureState=approved`,
      `${O}?source=imported`,
      `${O}?orderDateFrom=yesterday`,
      `${O}?amountFrom=lots`,
      `${O}?customerNo=`,
      `${O}/${encodeURIComponent("SO 0001;")}`,
    ]) {
      const res = await get("SUPPORT", path);
      expect(res.status, path).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    }
  });

  describe("the samples", () => {
    it("pages the 120 samples and counts the total after the filter", async () => {
      const first = await list("SUPPORT", "page=1&pageSize=50");
      expect(first.data).toHaveLength(50);
      expect(first.meta).toMatchObject({ page: 1, pageSize: 50, total: 120 });
      expect("mock" in first.meta).toBe(false);
      // The name comes from the synthetic set beside the number.
      for (const row of first.data) {
        const owner = dataset.customers.find((c) => c.no === row.customerNo);
        expect(row.customerName).toBe(owner?.name);
      }
      const last = await list("SUPPORT", "page=3&pageSize=50");
      expect(last.data).toHaveLength(20);
      const filtered = await list("SUPPORT", `customerNo=${customer.no}`);
      expect(filtered.meta.total).toBe(
        dataset.orders.filter((o) => o.header.sellToCustomerNo === customer.no)
          .length,
      );
    });

    it("is newest first by default, with no repeat across pages", async () => {
      const all = await list("SUPPORT", "pageSize=200");
      const dates = all.data.map((row) => row.orderDate);
      expect(dates).toEqual([...dates].sort().reverse());
      const a = await list("SUPPORT", "page=1&pageSize=60");
      const b = await list("SUPPORT", "page=2&pageSize=60");
      expect(new Set([...numbersOf(a.data), ...numbersOf(b.data)]).size).toBe(
        120,
      );
    });

    it("sorts by each column, both ways", async () => {
      for (const sort of [
        "orderNo",
        "customerNo",
        "orderDate",
        "shipmentDate",
        "amount",
        "captureState",
      ]) {
        const up = await list(
          "SUPPORT",
          `pageSize=200&sort=${sort}&direction=asc`,
        );
        const down = await list(
          "SUPPORT",
          `pageSize=200&sort=${sort}&direction=desc`,
        );
        expect(up.data, sort).toHaveLength(120);
        // Every sample has no capture state, so that column ties and keeps number order.
        if (sort !== "captureState")
          expect(numbersOf(down.data), sort).not.toEqual(numbersOf(up.data));
      }
      const byAmount = await list(
        "SUPPORT",
        "pageSize=200&sort=amount&direction=asc",
      );
      const amounts = byAmount.data.map((row) => Number(row.amount.value));
      expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
    });

    it("filters by search, source, capture state and date range", async () => {
      const one = dataset.orders[5];
      if (!one) throw new Error("no sixth order");
      expect(
        numbersOf((await list("SUPPORT", `search=${one.header.no}`)).data),
      ).toContain(one.header.no);
      const po = await list(
        "SUPPORT",
        `search=${encodeURIComponent(one.header.externalDocumentNo)}`,
      );
      expect(numbersOf(po.data)).toContain(one.header.no);
      expect((await list("SUPPORT", "source=sample")).meta.total).toBe(120);
      expect((await list("SUPPORT", "captureState=draft")).meta.total).toBe(0);
      const day = one.header.orderDate;
      const ranged = await list(
        "SUPPORT",
        `orderDateFrom=${day}&orderDateTo=${day}&pageSize=200`,
      );
      expect(ranged.data.length).toBeGreaterThan(0);
      expect(ranged.data.every((row) => row.orderDate === day)).toBe(true);
    });

    it("filters by amount range for a role that sees amounts", async () => {
      const ranged = await list(
        "SUPPORT",
        "amountFrom=1000&amountTo=5000&pageSize=200",
      );
      expect(
        ranged.data.every((row) => {
          const value = Number(row.amount.value);
          return value >= 1000 && value <= 5000;
        }),
      ).toBe(true);
    });

    it("gives stock=waiting exactly the samples short and not yet covered", async () => {
      expect(waitingSamples.length).toBeGreaterThan(0);
      const waiting = await list("SUPPORT", "stock=waiting&pageSize=200");
      expect(numbersOf(waiting.data).sort()).toEqual(
        [...waitingSamples].sort(),
      );
      expect(waiting.data.every((row) => row.shortage !== null)).toBe(true);
      expect(waiting.data.every((row) => row.shortageCount === 1)).toBe(true);
    });

    it("answers the reader against its contract, with the workflow status", async () => {
      const sample = dataset.orders[0];
      if (!sample) throw new Error("no order");
      const shown = salesOrderResponseSchema.parse(
        (await get("SUPPORT", `${O}/${sample.header.no}`)).body,
      );
      expect(shown.data).toMatchObject({
        orderNo: sample.header.no,
        source: "sample",
        captureState: null,
      });
      expect(shown.data.workflowStatus).not.toBeNull();
      expect(shown.data.lines).toHaveLength(sample.lines.length);
    });
  });

  describe("masking in the response body", () => {
    it("shows amounts to Support and hides them from Warehouse and Logistics", async () => {
      const sample = dataset.orders[0];
      if (!sample) throw new Error("no order");
      const path = `${O}/${sample.header.no}`;
      const support = JSON.stringify((await get("SUPPORT", path)).body);
      expect(support).toContain(`"${sample.total}"`);
      for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
        const text = JSON.stringify((await get(role, path)).body);
        expect(text).not.toContain(`"${sample.total}"`);
        expect(text).not.toContain(`"${sample.lines[0]?.unitPrice ?? "?"}"`);
        expect(text).toContain('"price"');
        const rows = await list(role, "pageSize=200");
        expect(rows.data[0]?.amount).toMatchObject({
          masked: true,
          value: null,
          reason: "price",
        });
      }
    });

    it("gives a masked sort by amount the default order, so the order does not leak", async () => {
      const plain = await list("WAREHOUSE", "pageSize=200");
      for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
        const sorted = await list(role, "pageSize=200&sort=amount");
        expect(numbersOf(sorted.data)).toEqual(numbersOf(plain.data));
      }
      const seen = await list("SUPPORT", "pageSize=200&sort=amount");
      expect(numbersOf(seen.data)).not.toEqual(numbersOf(plain.data));
    });

    it("ignores an amount range for a masked role", async () => {
      const ranged = await list(
        "WAREHOUSE",
        "amountFrom=999999999&pageSize=200",
      );
      expect(ranged.meta.total).toBe(120);
    });
  });

  describe("stored orders", () => {
    beforeAll(async () => {
      await store(STORED_DRAFT, { captureState: "draft" });
      await store(STORED_VOID, { captureState: "void" });
    });

    it("shows a stored order in the list and the reader, with no workflow status", async () => {
      const rows = await list("SUPPORT", "source=stored");
      expect(numbersOf(rows.data)).toEqual([STORED_DRAFT, STORED_VOID]);
      expect(rows.data[0]).toMatchObject({
        source: "stored",
        captureState: "draft",
        workflowStatus: null,
        // Looked up in master data by the number, never by name.
        customerNo: customer.no,
        customerName: customer.name,
      });
      const waiting = await list("SUPPORT", "stock=waiting&pageSize=200");
      const formats = waiting.data.map((r) => r.shortage?.ordered ?? "");
      // Samples and stored orders write the quantity the same way.
      expect(formats.every((q) => /^\d+\.\d{2}$/.test(q))).toBe(true);
      expect(
        (await list("SUPPORT", "source=sample&pageSize=200")).data,
      ).toHaveLength(120);
      expect((await list("SUPPORT")).meta.total).toBe(122);
      const shown = salesOrderResponseSchema.parse(
        (await get("SUPPORT", `${O}/${STORED_DRAFT}`)).body,
      );
      expect(shown.data).toMatchObject({
        source: "stored",
        navisionNo: null,
        lines: [
          {
            itemNo: item.no,
            unitPrice: { value: "12.50" },
            lineAmount: { value: "1249987.50" },
          },
        ],
      });
    });

    it("filters stored orders by capture state", async () => {
      expect(
        numbersOf((await list("SUPPORT", "captureState=draft")).data),
      ).toEqual([STORED_DRAFT]);
      expect(
        numbersOf((await list("SUPPORT", "captureState=void")).data),
      ).toEqual([STORED_VOID]);
    });

    it("says by how much a draft is short, and never for a void order", async () => {
      const stock = itemResponseSchema.parse(
        (await get("SUPPORT", `${API}/master-data/items/${item.no}`)).body,
      ).data.availableStock;
      const short = (Number("99999") - Number(stock)).toFixed(2);
      const waiting = await list("SUPPORT", "stock=waiting&pageSize=200");
      expect(numbersOf(waiting.data)).toContain(STORED_DRAFT);
      expect(numbersOf(waiting.data)).not.toContain(STORED_VOID);
      const row = waiting.data.find((r) => r.orderNo === STORED_DRAFT);
      expect(row?.shortage).toMatchObject({ itemNo: item.no, shortBy: short });
      const shown = salesOrderResponseSchema.parse(
        (await get("SUPPORT", `${O}/${STORED_DRAFT}`)).body,
      );
      expect(shown.data.lines[0]?.shortBy).toBe(short);
    });

    it("hides a stored order's amounts from Warehouse as well", async () => {
      const text = JSON.stringify(
        (await get("WAREHOUSE", `${O}/${STORED_DRAFT}`)).body,
      );
      expect(text).not.toContain("12.50");
      expect(text).not.toContain("1249987.50");
    });
  });
});
