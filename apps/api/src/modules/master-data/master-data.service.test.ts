import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { addDecimal, compareDecimal } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../common/domain-error.js";
import { MockChecksRepository } from "../checks/mock-checks.repository.js";
import { MockOrderStatusReader } from "../checks/mock-order-status-reader.js";
import { TrackerService } from "../checks/tracker.service.js";
import type { MasterDataSalesOrder } from "./domain/master-data-reader.js";
import {
  LOW_STOCK_THRESHOLD,
  StockPosition,
  isOpenOrder,
} from "./domain/stock-position.js";
import { MasterDataService } from "./master-data.service.js";
import { MockNavisionMasterData } from "./mock-navision-master-data.js";

const dataset = createSyntheticDataset();
const service = new MasterDataService(
  new MockNavisionMasterData(() => dataset),
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

  it("stops being short once an open purchase order brings the rest", () => {
    const stock = new StockPosition(
      stockOf({ inventory: "100", so: "60", po: "106" }),
      [order({ stockShortfall: shortfall })],
    );
    expect(stock.availableStock).toBe("146.00");
    expect(stock.availability).toBe("ok");
  });

  it("calls an item low only under the threshold", () => {
    const at = (po: string) =>
      new StockPosition(stockOf({ inventory: "0", so: "0", po }), [])
        .availability;
    expect(at(LOW_STOCK_THRESHOLD)).toBe("ok");
    expect(at(String(Number(LOW_STOCK_THRESHOLD) - 1))).toBe("low");
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

  it("lists as short exactly the items an open order cannot be covered for", async () => {
    const reader = new MockNavisionMasterData(() => dataset);
    const orders = await reader.salesOrders();
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
  it("adds its counted lines and the rest up to Qty. on Sales Order, and its purchase lines to Qty. on Purch. Order", async () => {
    for (const item of dataset.items) {
      const detail = await service.item(item.no, "SUPPORT");
      const { listed, other } = detail.salesOrderBreakdown;
      expect(Number(other)).toBeGreaterThanOrEqual(0);
      expect(Number(addDecimal(listed, other))).toBe(
        Number(item.qtyOnSalesOrder),
      );
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

  it("names the purchase order that covers an approved SPR's line", async () => {
    const spr = dataset.sprs.find((s) =>
      dataset.purchaseOrders.some(
        (po) => po.no === s.navisionNo && po.status === "open",
      ),
    );
    if (!spr) throw new Error("no open SPR order");
    const detail = await service.item(spr.itemNo, "SUPPORT");
    const held = detail.orderLines.find((line) => line.heldOut);
    expect(held?.shortfall).toMatchObject({
      state: "covered",
      purchaseOrderNo: spr.navisionNo,
      sprRecordNo: spr.recordNo,
    });
    expect(detail.availability).not.toBe("short");
    expect(detail.purchaseLines.map((l) => l.purchaseOrderNo)).toContain(
      spr.navisionNo,
    );
  });

  it("answers an unknown item with not found", async () => {
    await expect(service.item("I-NOPE", "SUPPORT")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("customers over the mock", () => {
  it("filters by country, payment terms and price group", async () => {
    const some = dataset.customers[0];
    if (!some) throw new Error("no customer");
    const found = await service.listCustomers({
      ...everything,
      country: some.countryRegionCode,
      paymentTerms: some.paymentTermsCode,
      priceGroup: some.customerPriceGroup,
    });
    expect(found.items.map((r) => r.no)).toContain(some.no);
    for (const row of found.items) {
      expect(row.countryRegionCode).toBe(some.countryRegionCode);
    }
  });

  it("counts what the detail lists, and overdue agrees with the tracker", async () => {
    const list = await service.listCustomers(everything);
    expect(list.items.some((row) => row.overdueOrders > 0)).toBe(true);
    for (const row of list.items) {
      const detail = await service.customer(row.no, "SUPPORT");
      expect(detail.openOrders).toHaveLength(row.openOrders);
      expect(detail.overdueOrders).toHaveLength(row.overdueOrders);
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
    const list = await service.listVendors(everything);
    expect(list.total).toBe(dataset.vendors.length);
    for (const row of list.items) {
      const detail = await service.vendor(row.no, "FINANCE");
      expect(detail.openPurchaseOrders).toHaveLength(row.openPurchaseOrders);
      expect(detail.items).toHaveLength(row.itemsSupplied);
      expect(detail.bankAccounts.length).toBeGreaterThan(0);
    }
  });

  it("sorts by balance as a number", async () => {
    const list = await service.listVendors({
      ...everything,
      sort: "balanceLcy",
      direction: "desc",
    });
    const figures = list.items.map((r) => Number(r.balanceLcy));
    expect(figures).toEqual([...figures].sort((a, b) => b - a));
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

  it("shows item cost to Finance, Management and the Product Manager", async () => {
    const no = dataset.items[0]?.no ?? "";
    for (const role of ["FINANCE", "MANAGEMENT", "PRODUCT_MANAGER"] as const) {
      expect((await service.item(no, role)).unitCost.masked).toBe(false);
    }
    for (const role of ["SUPPORT", "APPROVER", "WAREHOUSE"] as const) {
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

  it("masks amounts built from a hidden price or cost", async () => {
    const customerNo = dataset.orders[0]?.header.sellToCustomerNo ?? "";
    const customer = await service.customer(customerNo, "WAREHOUSE");
    expect(customer.openOrders.every((o) => o.amount.masked)).toBe(true);
    const vendor = await service.vendor(vendorNo, "SUPPORT");
    expect(vendor.openPurchaseOrders.every((po) => po.total.masked)).toBe(true);
  });
});
