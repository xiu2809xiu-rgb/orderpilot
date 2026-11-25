import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { LOW_STOCK_THRESHOLD, compareDecimal } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../common/domain-error.js";
import { SampleOrderSource } from "../orders/directory/sample-order-source.js";
import { MockChecksRepository } from "../checks/mock-checks.repository.js";
import { MockOrderStatusReader } from "../checks/mock-order-status-reader.js";
import { TrackerService } from "../checks/tracker.service.js";
import type { MasterDataSalesOrder } from "./domain/master-data-reader.js";
import { StockPosition, isOpenOrder } from "./domain/stock-position.js";
import { MasterDataService } from "./master-data.service.js";
import { MockBusinessCentralMasterData } from "./mock-business-central-master-data.js";

const dataset = createSyntheticDataset();
const service = new MasterDataService(
  new MockBusinessCentralMasterData(() => dataset),
  new SampleOrderSource(() => dataset),
);
const tracker = new TrackerService(
  new MockChecksRepository(() => dataset),
  new MockOrderStatusReader(() => dataset),
);

const everything = { page: 1, pageSize: 200 };
const allItems = () =>
  Promise.all(
    [1, 2].map((page) => service.listItems({ page, pageSize: 200 }, "SUPPORT")),
  ).then((pages) => pages.flatMap((p) => [...p.items]));

function order(patch: Partial<MasterDataSalesOrder>): MasterDataSalesOrder {
  return {
    no: "SO-1",
    customerNo: "C-1",
    externalDocumentNo: "PO-1",
    orderDate: "2026-10-01",
    shipmentDate: null,
    status: "Open",
    total: "100.00",
    lines: [{ no: "I-1", qtyToShip: "146" }],
    stockShortfall: null,
    overdue: null,
    ...patch,
  };
}

const stockOf = (figures: { inventory: string; so: string; po: string }) => ({
  no: "I-1",
  inventory: figures.inventory,
  qtyOnSalesOrder: figures.so,
  qtyOnPurchOrder: figures.po,
});

describe("the stock position of an item", () => {
  const shortfall = {
    itemNo: "I-1",
    ordered: "146",
    availableStock: "46",
    shortBy: "100",
    coveredBy: null,
  };

  it("works out available stock by the formula", () => {
    const stock = new StockPosition(
      stockOf({ inventory: "100", so: "60", po: "6" }),
      [],
    );
    expect(stock.availableStock).toBe("46.00");
  });

  it("calls an item short from the order, though its stock is positive", () => {
    const stock = new StockPosition(
      stockOf({ inventory: "100", so: "60", po: "6" }),
      [order({ stockShortfall: shortfall })],
    );
    expect(Number(stock.availableStock)).toBeGreaterThan(0);
    expect(stock.availability).toBe("short");
  });

  it("ignores a shortfall on an order that has nothing left to ship", () => {
    const shipped = order({
      stockShortfall: shortfall,
      lines: [{ no: "I-1", qtyToShip: "0" }],
    });
    expect(isOpenOrder(shipped)).toBe(false);
    const stock = new StockPosition(
      stockOf({ inventory: "100", so: "60", po: "6" }),
      [shipped],
    );
    expect(stock.availability).toBe("ok");
  });

  it("counts a line as demand once its SPR is approved, so the item is not free to sell", () => {
    // The SPR's 100 is on order, and the 146 joined Qty. on Sales Order.
    const covered = order({
      stockShortfall: { ...shortfall, coveredBy: "PO-1" },
    });
    const stock = new StockPosition(
      stockOf({ inventory: "100", so: "206", po: "106" }),
      [covered],
    );
    expect(stock.isHeldOut(covered)).toBe(false);
    expect(stock.isShortOn(covered)).toBe(false);
    expect(stock.availableStock).toBe("0.00");
    expect(stock.availability).toBe("low");
  });

  it("calls an item low only under the threshold", () => {
    const at = (po: string) =>
      new StockPosition(stockOf({ inventory: "0", so: "0", po }), [])
        .availability;
    expect(at(String(LOW_STOCK_THRESHOLD))).toBe("ok");
    expect(at(String(LOW_STOCK_THRESHOLD - 1))).toBe("low");
  });
});

describe("items over the mock", () => {
  it("pages, and the pages hold every item once", async () => {
    const rows = await allItems();
    expect(rows).toHaveLength(dataset.items.length);
    expect(new Set(rows.map((r) => r.no)).size).toBe(dataset.items.length);
  });

  it("searches number, description and part number", async () => {
    const some = dataset.items[7];
    if (!some) throw new Error("no item");
    for (const search of [
      some.no.toLowerCase(),
      some.partNumber,
      some.description.slice(0, 12),
    ]) {
      const found = await service.listItems(
        { ...everything, search },
        "SUPPORT",
      );
      expect(found.items.map((r) => r.no)).toContain(some.no);
    }
  });

  it("finds an item by its vendor's number and name", async () => {
    const some = dataset.items[7];
    const vendor = dataset.vendors.find((v) => v.no === some?.vendorNo);
    if (!some || !vendor) throw new Error("no item or vendor");
    for (const search of [vendor.no, vendor.name.split(" ")[0] ?? ""]) {
      const found = await service.listItems(
        { ...everything, search },
        "SUPPORT",
      );
      expect(found.items.map((r) => r.no)).toContain(some.no);
      // Every hit is that vendor's, or has the words somewhere else it shows.
      expect(found.total).toBeGreaterThan(0);
    }
    const byVendor = await service.listItems(
      { ...everything, search: vendor.no },
      "SUPPORT",
    );
    expect(byVendor.items.every((r) => r.vendorNo === vendor.no)).toBe(true);
  });

  it("filters by brand, category and vendor", async () => {
    const some = dataset.items[0];
    if (!some) throw new Error("no item");
    const found = await service.listItems(
      {
        ...everything,
        brand: some.brand,
        category: some.category,
        vendor: some.vendorNo,
      },
      "SUPPORT",
    );
    expect(found.total).toBeGreaterThan(0);
    for (const row of found.items) {
      expect(row.brand).toBe(some.brand);
      expect(row.category).toBe(some.category);
      expect(row.vendorNo).toBe(some.vendorNo);
    }
  });

  it("lists as short exactly the items an open order waits on an SPR for", async () => {
    const reader = new MockBusinessCentralMasterData(() => dataset);
    // An approved SPR covers its order: its purchase order brings the rest.
    const orders = (await reader.salesOrders()).filter(
      (o) =>
        dataset.sprs.find((spr) => spr.orderNo === o.no)?.status !== "approved",
    );
    const short = await service.listItems(
      { ...everything, availability: "short" },
      "SUPPORT",
    );
    expect(short.total).toBeGreaterThan(5);
    const expected = dataset.items
      .filter((item) => {
        const need = orders.find(
          (o) => isOpenOrder(o) && o.stockShortfall?.itemNo === item.no,
        )?.stockShortfall?.ordered;
        return (
          need !== undefined &&
          compareDecimal(need, new StockPosition(item, []).availableStock) > 0
        );
      })
      .map((item) => item.no)
      .sort();
    expect(short.items.map((r) => r.no).sort()).toEqual(expected);
    expect(short.items.every((r) => Number(r.availableStock) > 0)).toBe(true);
  });

  it("gives every availability a count that adds up", async () => {
    const totals = await Promise.all(
      (["short", "low", "ok"] as const).map(
        async (availability) =>
          (await service.listItems({ ...everything, availability }, "SUPPORT"))
            .total,
      ),
    );
    expect(totals.every((total) => total > 0)).toBe(true);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(dataset.items.length);
  });

  it("sorts numbers as numbers, both ways", async () => {
    const query = { ...everything, sort: "availableStock" as const };
    const asc = await service.listItems(
      { ...query, direction: "asc" },
      "SUPPORT",
    );
    const desc = await service.listItems(
      { ...query, direction: "desc" },
      "SUPPORT",
    );
    const figures = asc.items.map((r) => Number(r.availableStock));
    expect(figures).toEqual([...figures].sort((a, b) => a - b));
    expect(Number(desc.items[0]?.availableStock)).toBeGreaterThanOrEqual(
      Number(figures.at(-1)),
    );
  });

  it("will not sort by a price the role cannot see", async () => {
    const plain = await service.listItems(everything, "WAREHOUSE");
    const sorted = await service.listItems(
      { ...everything, sort: "unitPrice", direction: "desc" },
      "WAREHOUSE",
    );
    expect(sorted.items.map((r) => r.no)).toEqual(plain.items.map((r) => r.no));
    const allowed = await service.listItems(
      { ...everything, sort: "unitPrice", direction: "desc" },
      "SUPPORT",
    );
    expect(allowed.items.map((r) => r.no)).not.toEqual(
      plain.items.map((r) => r.no),
    );
  });
});

describe("one item's numbers agree", () => {
  it("adds its counted lines up to Qty. on Sales Order, and its purchase lines to Qty. on Purch. Order", async () => {
    let withDemand = 0;
    for (const item of dataset.items) {
      const detail = await service.item(item.no, "SUPPORT");
      const { listed } = detail.salesOrderBreakdown;
      // Summed from the lines the page shows, against the item card's own figure.
      expect(Number(listed), item.no).toBe(Number(item.qtyOnSalesOrder));
      if (Number(item.qtyOnSalesOrder) > 0) withDemand++;
      const counted = detail.orderLines
        .filter((line) => !line.heldOut)
        .reduce((sum, line) => sum + Number(line.quantity), 0);
      expect(counted).toBe(Number(listed));
      expect(
        detail.purchaseLines.reduce(
          (sum, line) => sum + Number(line.outstandingQuantity),
          0,
        ),
      ).toBe(Number(item.qtyOnPurchOrder));
    }
    expect(withDemand).toBeGreaterThan(50);
  });

  it("says what a short order needs, has and lacks", async () => {
    const short = await service.listItems(
      { ...everything, availability: "short" },
      "SUPPORT",
    );
    const no = short.items[0]?.no ?? "";
    const detail = await service.item(no, "SUPPORT");
    const held = detail.orderLines.find((line) => line.heldOut);
    expect(held?.shortfall?.state).toBe("waiting");
    expect(held?.shortfall?.availableStock).toBe(detail.availableStock);
    expect(Number(held?.shortfall?.ordered)).toBe(
      Number(held?.shortfall?.availableStock) +
        Number(held?.shortfall?.shortBy),
    );
    expect(detail.availability).toBe("short");
  });

  it.each(["open", "received"] as const)(
    "counts an approved SPR's line as demand, and names its %s purchase order",
    async (status) => {
      const spr = dataset.sprs.find((s) => {
        const order = dataset.orders.find((o) => o.header.no === s.orderNo);
        return (
          order?.lines.some(
            (l) => l.no === s.itemNo && Number(l.qtyToShip) > 0,
          ) &&
          dataset.purchaseOrders.some(
            (po) => po.no === s.navisionNo && po.status === status,
          )
        );
      });
      if (!spr) throw new Error(`no ${status} SPR order`);
      const detail = await service.item(spr.itemNo, "PRODUCT_MANAGER");
      const line = detail.orderLines.find((l) => l.orderNo === spr.orderNo);
      expect(line).toMatchObject({ heldOut: false });
      expect(line?.shortfall).toMatchObject({
        state: "covered",
        purchaseOrderNo: spr.navisionNo,
        purchaseOrderStatus: status,
        sprRecordNo: spr.recordNo,
      });
      // The order takes everything there is, so nothing is free to sell.
      expect(Number(detail.availableStock)).toBe(0);
      expect(detail.availability).toBe("low");
      expect(
        detail.sprs.find((r) => r.recordNo === spr.recordNo),
      ).toMatchObject({
        navisionNo: spr.navisionNo,
        purchaseOrderStatus: status,
      });
      expect(
        detail.purchaseLines
          .map((l) => l.purchaseOrderNo)
          .includes(spr.navisionNo ?? ""),
      ).toBe(status === "open");
    },
  );

  it("gives an SPR that is not approved no purchase order", async () => {
    const spr = dataset.sprs.find((s) => s.status !== "approved");
    if (!spr) throw new Error("no waiting SPR");
    const detail = await service.item(spr.itemNo, "SUPPORT");
    expect(detail.sprs.find((r) => r.recordNo === spr.recordNo)).toMatchObject({
      navisionNo: null,
      purchaseOrderStatus: null,
    });
  });

  it("answers an unknown item with not found", async () => {
    await expect(service.item("I-NOPE", "SUPPORT")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("customers over the mock", () => {
  it("filters by country and payment terms", async () => {
    const some = dataset.customers[0];
    if (!some) throw new Error("no customer");
    const found = await service.listCustomers({
      ...everything,
      country: some.countryRegionCode,
      paymentTerms: some.paymentTermsCode,
    });
    expect(found.items.map((r) => r.no)).toContain(some.no);
    for (const row of found.items) {
      expect(row.countryRegionCode).toBe(some.countryRegionCode);
    }
  });

  it("finds a customer by its country's name and by its code", async () => {
    const some = dataset.customers.find((c) => c.countryRegionCode === "LK");
    if (!some) throw new Error("no customer in Sri Lanka");
    const inCountry = dataset.customers.filter(
      (c) => c.countryRegionCode === "LK",
    );
    for (const search of ["Sri Lanka", "sri lanka", "LK", "lk"]) {
      const found = await service.listCustomers({ ...everything, search });
      expect(found.items.map((r) => r.no)).toContain(some.no);
      expect(
        found.items.filter((r) => r.countryRegionCode === "LK"),
      ).toHaveLength(inCountry.length);
    }
  });

  it("does not find every customer by a two-letter code", async () => {
    const found = await service.listCustomers({ ...everything, search: "IN" });
    const india = dataset.customers.filter((c) => c.countryRegionCode === "IN");
    // Names that merely contain "in" are still found, as before, but a
    // customer elsewhere with no "in" in its name is not.
    expect(found.items.length).toBeGreaterThanOrEqual(india.length);
    expect(found.items.length).toBeLessThan(dataset.customers.length);
  });

  it("counts what the detail lists, and overdue agrees with the tracker", async () => {
    const list = await service.listCustomers(everything);
    expect(list.items.some((row) => row.overdueOrders > 0)).toBe(true);
    for (const row of list.items) {
      const detail = await service.customer(row.no, "SUPPORT");
      expect(detail.openOrders).toHaveLength(row.openOrders);
      expect(detail.overdueOrders).toHaveLength(row.overdueOrders);
      for (const late of detail.overdueOrders) {
        expect(late.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(late.step.length).toBeGreaterThan(0);
      }
      const late = await tracker.list({
        page: 1,
        pageSize: 200,
        search: row.no,
        overdue: "true",
      });
      expect(late.total).toBe(row.overdueOrders);
    }
  });

  it("matches on the number: a look-alike name finds nothing by number", async () => {
    await expect(
      service.customer(dataset.customers[0]?.name ?? "", "SUPPORT"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("vendors over the mock", () => {
  it("counts what the detail lists", async () => {
    const list = await service.listVendors(everything, "FINANCE");
    expect(list.total).toBe(dataset.vendors.length);
    for (const row of list.items) {
      const detail = await service.vendor(row.no, "FINANCE");
      expect(detail.openPurchaseOrders).toHaveLength(row.openPurchaseOrders);
      expect(detail.items).toHaveLength(row.itemsSupplied);
      expect(detail.bankAccounts.length).toBeGreaterThan(0);
    }
  });

  it("sorts by balance as a number, but not for a role that cannot see it", async () => {
    const query = {
      ...everything,
      sort: "balanceLcy" as const,
      direction: "desc" as const,
    };
    const list = await service.listVendors(query, "FINANCE");
    const figures = list.items.map((r) => Number(r.balanceLcy.value));
    expect(figures).toEqual([...figures].sort((a, b) => b - a));
    const plain = await service.listVendors(everything, "WAREHOUSE");
    const hidden = await service.listVendors(query, "WAREHOUSE");
    expect(hidden.items.map((r) => r.no)).toEqual(plain.items.map((r) => r.no));
  });
});

describe("a customer's last prices", () => {
  it("gives one row for an item asked for twice", async () => {
    const order = dataset.orders[0];
    const buyer = order?.header.sellToCustomerNo;
    const bought = order?.lines[0]?.no;
    if (!buyer || !bought) throw new Error("the set has no order line");
    const rows = await service.lastPrices(
      buyer,
      [bought, bought, bought],
      "SUPPORT",
    );
    expect(rows.map((row) => row.itemNo)).toEqual([bought]);
  });
});

describe("masking", () => {
  const vendorNo = dataset.vendors[0]?.no ?? "";
  const account = dataset.vendorBankAccounts.find(
    (a) => a.vendorNo === vendorNo,
  );

  it("shows bank details to Finance alone", async () => {
    const finance = await service.vendor(vendorNo, "FINANCE");
    expect(finance.bankAccounts[0]?.iban.value).toBe(account?.iban);
    for (const role of ["SUPPORT", "WAREHOUSE", "MANAGEMENT"] as const) {
      const other = await service.vendor(vendorNo, role);
      const bank = other.bankAccounts[0];
      expect(bank?.iban).toMatchObject({
        masked: true,
        value: null,
        reason: "bankDetails",
      });
      expect(bank?.bankAccountNo.value).toBeNull();
      expect(bank?.swiftCode.value).toBeNull();
      expect(bank?.bankName.value).toBeNull();
    }
  });

  it("shows item cost to Finance, the approver, Management and the Product Manager", async () => {
    const no = dataset.items[0]?.no ?? "";
    // The approver joined at ADR 0058 step 4, taking what Management sees.
    for (const role of [
      "FINANCE",
      "APPROVER",
      "MANAGEMENT",
      "PRODUCT_MANAGER",
    ] as const) {
      expect((await service.item(no, role)).unitCost.masked).toBe(false);
    }
    for (const role of ["SUPPORT", "WAREHOUSE"] as const) {
      const detail = await service.item(no, role);
      expect(detail.unitCost).toMatchObject({ masked: true, reason: "price" });
    }
  });

  it("hides the selling price from Warehouse and Logistics only", async () => {
    const no = dataset.items[0]?.no ?? "";
    for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
      const detail = await service.item(no, role);
      expect(detail.unitPrice).toMatchObject({ masked: true, value: null });
    }
    for (const role of [
      "SUPPORT",
      "PRODUCT_MANAGER",
      "APPROVER",
      "FINANCE",
      "MANAGEMENT",
      "AUDITOR",
    ] as const) {
      expect((await service.item(no, role)).unitPrice.masked).toBe(false);
    }
  });

  it("hides balances and credit limits from Warehouse and Logistics, with the reason", async () => {
    const customerNo = dataset.customers[0]?.no ?? "";
    for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
      const customer = await service.customer(customerNo, role);
      const vendor = await service.vendor(vendorNo, role);
      const rows = await service.listVendors(everything, role);
      for (const field of [
        customer.creditLimitLcy,
        customer.balanceLcy,
        vendor.balanceLcy,
        ...rows.items.map((r) => r.balanceLcy),
      ]) {
        expect(field).toMatchObject({
          masked: true,
          value: null,
          reason: "role",
        });
      }
    }
    for (const role of ["SUPPORT", "FINANCE", "MANAGEMENT"] as const) {
      const customer = await service.customer(customerNo, role);
      expect(customer.creditLimitLcy.value).toBe(
        dataset.customers[0]?.creditLimitLcy,
      );
      expect((await service.vendor(vendorNo, role)).balanceLcy.masked).toBe(
        false,
      );
    }
  });

  it("masks amounts built from a hidden price or cost", async () => {
    const customerNo = dataset.orders[0]?.header.sellToCustomerNo ?? "";
    const customer = await service.customer(customerNo, "WAREHOUSE");
    expect(customer.openOrders.every((o) => o.amount.masked)).toBe(true);
    const vendor = await service.vendor(vendorNo, "SUPPORT");
    expect(vendor.openPurchaseOrders.every((po) => po.total.masked)).toBe(true);
  });
});
