import {
  ROLES,
  customerListSchema,
  customerResponseSchema,
  itemListSchema,
  itemResponseSchema,
  masterDataFiltersResponseSchema,
  vendorListSchema,
  vendorResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const M = `${API}/master-data`;

describe("master data routes (mock Navision)", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  const dataset = syntheticDataset();
  const item = dataset.items[0];
  const customer = dataset.customers[0];
  const vendor = dataset.vendors[0];
  if (!item || !customer || !vendor) throw new Error("the set is empty");

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

  const routes = [
    `${M}/filters`,
    `${M}/items`,
    `${M}/items/${item.no}`,
    `${M}/customers`,
    `${M}/customers/${customer.no}`,
    `${M}/vendors`,
    `${M}/vendors/${vendor.no}`,
  ];

  it("answers 401 with no session on every route", async () => {
    for (const route of routes) {
      expect((await call(t, null, "get", route)).status).toBe(401);
    }
  });

  it("answers 403 without orders.read on every route, and 200 with it", async () => {
    for (const route of routes) {
      expect((await get("SYSTEM_ADMIN", route)).status).toBe(403);
      expect((await get("WAREHOUSE", route)).status).toBe(200);
    }
  });

  it("answers an unknown number with the standard 404 envelope", async () => {
    for (const route of ["items", "customers", "vendors"]) {
      const res = await get("SUPPORT", `${M}/${route}/NOPE-1`);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    }
  });

  it("refuses bad input with the validation envelope", async () => {
    for (const path of [
      `${M}/items?pageSize=500`,
      `${M}/items?availability=plenty`,
      `${M}/items?sort=cost`,
      `${M}/items?vendor=${encodeURIComponent("V 1;")}`,
      `${M}/customers?page=0`,
      `${M}/customers?sort=balance`,
      `${M}/vendors?direction=sideways`,
      `${M}/items/${encodeURIComponent("I 0001;")}`,
    ]) {
      const res = await get("SUPPORT", path);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    }
  });

  it("pages, filters and stamps meta.mock on the lists", async () => {
    const items = itemListSchema.parse(
      (
        await get(
          "SUPPORT",
          `${M}/items?page=2&pageSize=3&brand=${item.brand}&sort=no&direction=desc`,
        )
      ).body,
    );
    expect(items.data).toHaveLength(3);
    expect(items.data.every((row) => row.brand === item.brand)).toBe(true);
    expect(items.meta).toMatchObject({ page: 2, pageSize: 3, mock: true });

    const customers = customerListSchema.parse(
      (
        await get(
          "SUPPORT",
          `${M}/customers?country=${customer.countryRegionCode}`,
        )
      ).body,
    );
    expect(customers.meta.mock).toBe(true);
    expect(
      customers.data.every(
        (row) => row.countryRegionCode === customer.countryRegionCode,
      ),
    ).toBe(true);

    const vendors = vendorListSchema.parse(
      (await get("SUPPORT", `${M}/vendors?search=${vendor.no}`)).body,
    );
    expect(vendors.meta).toMatchObject({ total: 1, mock: true });
  });

  it("answers the details and the filters against their contracts", async () => {
    const shown = itemResponseSchema.parse(
      (await get("SUPPORT", `${M}/items/${item.no}`)).body,
    );
    expect(shown.meta.mock).toBe(true);
    expect(shown.data.no).toBe(item.no);
    customerResponseSchema.parse(
      (await get("SUPPORT", `${M}/customers/${customer.no}`)).body,
    );
    vendorResponseSchema.parse(
      (await get("SUPPORT", `${M}/vendors/${vendor.no}`)).body,
    );
    const filters = masterDataFiltersResponseSchema.parse(
      (await get("SUPPORT", `${M}/filters`)).body,
    );
    expect(filters.data.brands).toContain(item.brand);
    expect(filters.data.vendors.map((v) => v.no)).toContain(vendor.no);
  });

  describe("masking in the response body", () => {
    const account = dataset.vendorBankAccounts.find(
      (a) => a.vendorNo === vendor.no,
    );
    const bankValues = [
      account?.bankAccountNo,
      account?.iban,
      account?.swiftCode,
      account?.name,
    ].filter((value): value is string => Boolean(value));

    it("holds no bank value anywhere for a masked role, and every one for Finance", async () => {
      const path = `${M}/vendors/${vendor.no}`;
      for (const role of ["WAREHOUSE", "SUPPORT", "MANAGEMENT"] as const) {
        const res = await get(role, path);
        const text = JSON.stringify(res.body);
        expect(res.status).toBe(200);
        for (const value of bankValues) expect(text).not.toContain(value);
        expect(text).toContain('"bankDetails"');
      }
      const finance = JSON.stringify((await get("FINANCE", path)).body);
      for (const value of bankValues) expect(finance).toContain(value);
    });

    it("holds no cost anywhere for a masked role, and no price for Warehouse", async () => {
      const path = `${M}/items/${item.no}`;
      const support = JSON.stringify((await get("SUPPORT", path)).body);
      expect(support).toContain(`"${item.unitPrice}"`);
      expect(support).not.toContain(`"${item.unitCost}"`);
      const finance = JSON.stringify((await get("FINANCE", path)).body);
      expect(finance).toContain(`"${item.unitCost}"`);

      const warehouse = JSON.stringify((await get("WAREHOUSE", path)).body);
      expect(warehouse).not.toContain(`"${item.unitPrice}"`);
      expect(warehouse).not.toContain(`"${item.unitCost}"`);
      for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
        const list = JSON.stringify(
          (await get(role, `${M}/items?pageSize=200`)).body,
        );
        expect(list).not.toContain(`"${item.unitPrice}"`);
      }
    });

    it("holds no purchase order total for a role that cannot see cost", async () => {
      const path = `${M}/vendors/${vendor.no}`;
      const open = dataset.purchaseOrders.find(
        (po) => po.buyFromVendorNo === vendor.no && po.status === "open",
      );
      if (!open) throw new Error("no open purchase order");
      const support = JSON.stringify((await get("SUPPORT", path)).body);
      expect(support).toContain(open.no);
      expect(support).not.toContain(`"${open.total}"`);
      const finance = JSON.stringify((await get("FINANCE", path)).body);
      expect(finance).toContain(`"${open.total}"`);
    });

    it("holds no order total for Warehouse on a customer's page", async () => {
      const owner = dataset.orders.find((o) =>
        o.lines.some((l) => Number(l.qtyToShip) > 0),
      );
      if (!owner) throw new Error("no open order");
      const path = `${M}/customers/${owner.header.sellToCustomerNo}`;
      const warehouse = JSON.stringify((await get("WAREHOUSE", path)).body);
      expect(warehouse).toContain(owner.header.no);
      expect(warehouse).not.toContain(`"${owner.total}"`);
      const support = JSON.stringify((await get("SUPPORT", path)).body);
      expect(support).toContain(`"${owner.total}"`);
    });

    it("holds no balance or credit limit for Warehouse and Logistics", async () => {
      const customer = dataset.customers[0];
      if (!customer) throw new Error("no customer");
      const figures = [
        [`${M}/customers/${customer.no}`, customer.creditLimitLcy],
        [`${M}/customers/${customer.no}`, customer.balanceLcy],
        [`${M}/vendors/${vendor.no}`, vendor.balanceLcy],
        [`${M}/vendors?pageSize=200`, vendor.balanceLcy],
      ] as const;
      for (const [path, value] of figures) {
        for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
          const text = JSON.stringify((await get(role, path)).body);
          expect(text).not.toContain(`"${value}"`);
        }
        const support = JSON.stringify((await get("SUPPORT", path)).body);
        expect(support).toContain(`"${value}"`);
      }
    });
  });
  describe("a stored order", () => {
    const orderNo = "SO-20261108-0001";

    it("shows up on the customer and the item once it is submitted, and not before", async () => {
      const customer = dataset.customers[0];
      if (!customer) throw new Error("no customer");
      const repository = t.app.get(SalesOrderRepository, { strict: false });
      const make = (no: string, captureState: "draft" | "submitted") =>
        new SalesOrder({
          orderNo: no,
          navisionNo: null,
          captureState,
          customerNo: customer.no,
          externalDocumentNo: `PO-${no.slice(-4)}`,
          orderDate: "2026-11-08",
          shipmentDate: null,
          currencyCode: "USD",
          prepaymentPercent: "0.00",
          createdBy: "00000000-0000-4000-8000-000000000001",
          lines: [
            {
              lineNo: 1,
              itemNo: item.no,
              description: item.description,
              quantity: "2",
              unitPrice: "12.50",
              qtyToShip: "2",
            },
          ],
        });
      const figures = async () =>
        itemResponseSchema.parse(
          (await get("SUPPORT", `${M}/items/${item.no}`)).body,
        ).data;
      const before = await figures();
      await repository.insert(make("SO-20261108-0002", "draft"));
      await repository.insert(make(orderNo, "submitted"));

      const shown = customerResponseSchema.parse(
        (await get("SUPPORT", `${M}/customers/${customer.no}`)).body,
      );
      const numbers = shown.data.openOrders.map((o) => o.orderNo);
      expect(numbers).toContain(orderNo);
      expect(numbers).not.toContain("SO-20261108-0002");
      const after = await figures();
      expect(after.orderLines.map((l) => l.orderNo)).toContain(orderNo);
      expect(after.orderLines).toHaveLength(before.orderLines.length + 1);
      expect(after.qtyOnSalesOrder).toBe(before.qtyOnSalesOrder);
      expect(after.availableStock).toBe(before.availableStock);
    });
  });
});
