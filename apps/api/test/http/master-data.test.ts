import {
  ROLES,
  AVAILABLE_STOCK_MAX_ITEMS,
  availableStockResponseSchema,
  customerListSchema,
  customerResponseSchema,
  itemListSchema,
  itemResponseSchema,
  lastPricesResponseSchema,
  masterDataFiltersResponseSchema,
  vendorListSchema,
  vendorResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { lastAgreedPrice, syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const M = `${API}/master-data`;

describe("master data routes (mock Business Central)", () => {
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

  it("searches items by their vendor and customers by their country, on the server", async () => {
    const byVendor = itemListSchema.parse(
      (
        await get(
          "SUPPORT",
          `${M}/items?search=${encodeURIComponent(vendor.name)}`,
        )
      ).body,
    );
    expect(byVendor.meta.total).toBeGreaterThan(0);
    expect(byVendor.data.every((row) => row.vendorNo === vendor.no)).toBe(true);

    const byCountry = customerListSchema.parse(
      (
        await get(
          "SUPPORT",
          `${M}/customers?search=${encodeURIComponent("Sri Lanka")}&pageSize=200`,
        )
      ).body,
    );
    const lk = dataset.customers.filter((c) => c.countryRegionCode === "LK");
    expect(byCountry.data.map((row) => row.no)).toEqual(
      expect.arrayContaining(lk.map((c) => c.no)),
    );
    const byCode = customerListSchema.parse(
      (await get("SUPPORT", `${M}/customers?search=LK&pageSize=200`)).body,
    );
    expect(byCode.data.map((row) => row.no)).toEqual(
      expect.arrayContaining(lk.map((c) => c.no)),
    );
  });

  it("keeps the paging and the masking when it searches by vendor", async () => {
    const page = itemListSchema.parse(
      (
        await get(
          "WAREHOUSE",
          `${M}/items?search=${vendor.no}&page=1&pageSize=2`,
        )
      ).body,
    );
    expect(page.data.length).toBeLessThanOrEqual(2);
    expect(page.meta).toMatchObject({ page: 1, pageSize: 2 });
    expect(page.meta.total).toBeGreaterThan(0);
    expect(page.data.every((row) => row.unitPrice.masked)).toBe(true);
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

  describe("available stock for many items", () => {
    const route = `${M}/available-stock`;
    const [first, second] = dataset.items;
    if (!first || !second) throw new Error("the set is empty");

    it("answers 401 with no session and 403 without orders.read", async () => {
      const path = `${route}?itemNos=${item.no}`;
      expect((await call(t, null, "get", path)).status).toBe(401);
      expect((await get("SYSTEM_ADMIN", path)).status).toBe(403);
    });

    it("refuses a bad format and more items than an order may hold", async () => {
      const tooMany = Array.from(
        { length: AVAILABLE_STOCK_MAX_ITEMS + 1 },
        (_, i) => `I-${String(i)}`,
      ).join(",");
      for (const query of [
        "",
        "itemNos=",
        "itemNos=I-1,,I-2",
        `itemNos=${encodeURIComponent("I 1;")}`,
        `itemNos=${tooMany}`,
      ]) {
        const res = await get("SUPPORT", `${route}?${query}`);
        expect(res.status, query).toBe(400);
        expect(res.body).toMatchObject({
          error: { code: "VALIDATION_FAILED" },
        });
      }
    });

    it("accepts as many items as an order may hold", async () => {
      const many = Array.from(
        { length: AVAILABLE_STOCK_MAX_ITEMS },
        (_, i) => `I-${String(i)}`,
      ).join(",");
      expect((await get("SUPPORT", `${route}?itemNos=${many}`)).status).toBe(
        200,
      );
    });

    it("gives each item the figure its own page gives, and leaves an unknown one out", async () => {
      const res = await get(
        "WAREHOUSE",
        `${route}?itemNos=${first.no},${second.no},I-NOPE`,
      );
      expect(res.status).toBe(200);
      const body = availableStockResponseSchema.parse(res.body);
      expect(body.meta.mock).toBe(true);
      expect(body.data.map((row) => row.itemNo).sort()).toEqual(
        [first.no, second.no].sort(),
      );
      for (const row of body.data) {
        const page = itemResponseSchema.parse(
          (await get("SUPPORT", `${M}/items/${row.itemNo}`)).body,
        );
        expect(row.availableStock).toBe(page.data.availableStock);
        expect(row.unit).toBe(page.data.baseUnitOfMeasure);
      }
    });
  });

  describe("a customer's last agreed prices", () => {
    const order = dataset.orders[0];
    const line = order?.lines[0];
    if (!order || !line) throw new Error("the set has no order line");
    const buyer = order.header.sellToCustomerNo;
    const route = `${M}/customers/${buyer}/last-prices`;
    const bought = line.no;
    const expected = lastAgreedPrice(dataset, buyer, bought);
    if (!expected) throw new Error("the order's own line has no price");
    // An item this customer never bought, to see it left out.
    const neverBought = dataset.items.find(
      (candidate) => !lastAgreedPrice(dataset, buyer, candidate.no),
    );
    if (!neverBought) throw new Error("this customer bought every item");

    it("answers 401 with no session and 403 without orders.read", async () => {
      const path = `${route}?itemNos=${bought}`;
      expect((await call(t, null, "get", path)).status).toBe(401);
      expect((await get("SYSTEM_ADMIN", path)).status).toBe(403);
    });

    it("refuses a bad format and more items than an order may hold", async () => {
      const tooMany = Array.from(
        { length: AVAILABLE_STOCK_MAX_ITEMS + 1 },
        (_, i) => `I-${String(i)}`,
      ).join(",");
      for (const query of ["", "itemNos=", `itemNos=${tooMany}`]) {
        const res = await get("SUPPORT", `${route}?${query}`);
        expect(res.status, query).toBe(400);
      }
    });

    it("holds the cap at 200 item numbers, written out as numbers", async () => {
      const ask = (count: number): string =>
        Array.from({ length: count }, (_, i) => `I-${String(i + 1)}`).join(",");
      expect(
        (await get("SUPPORT", `${route}?itemNos=${ask(200)}`)).status,
      ).toBe(200);
      expect(
        (await get("SUPPORT", `${route}?itemNos=${ask(201)}`)).status,
      ).toBe(400);
    });

    it("counts the item numbers as sent, so 201 repeats of one are refused", async () => {
      // The cap guards the request's size, before any repeat is dropped.
      const repeats = Array.from({ length: 201 }, () => "I-1").join(",");
      expect((await get("SUPPORT", `${route}?itemNos=${repeats}`)).status).toBe(
        400,
      );
    });

    it("answers 404 for a customer that is not there", async () => {
      const res = await get(
        "SUPPORT",
        `${M}/customers/C-9999/last-prices?itemNos=${bought}`,
      );
      expect(res.status).toBe(404);
    });

    it("gives the price, its date and its document, and leaves a never-bought item out", async () => {
      for (const role of [
        "PRODUCT_MANAGER",
        "APPROVER",
        "SUPPORT",
        "FINANCE",
        "MANAGEMENT",
        "AUDITOR",
      ] as const) {
        const res = await get(
          role,
          `${route}?itemNos=${bought},${neverBought.no}`,
        );
        expect(res.status, role).toBe(200);
        const body = lastPricesResponseSchema.parse(res.body);
        expect(body.meta.mock).toBe(true);
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
          itemNo: bought,
          agreedOn: expected.agreedOn,
          documentNo: expected.documentNo,
          price: { masked: false, value: expected.price },
        });
      }
    });

    it("holds no price anywhere for a role that sees no prices", async () => {
      for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
        const res = await get(role, `${route}?itemNos=${bought}`);
        expect(res.status, role).toBe(200);
        const body = lastPricesResponseSchema.parse(res.body);
        expect(body.data[0]?.price).toMatchObject({
          masked: true,
          value: null,
        });
        expect(JSON.stringify(res.body)).not.toContain(`"${expected.price}"`);
      }
    });
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
