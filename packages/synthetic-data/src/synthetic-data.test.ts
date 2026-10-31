import {
  compareDecimal,
  decimalStringSchema,
  salesHeaderSchema,
  salesLineSchema,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  AS_OF,
  DEFAULT_SEED,
  SAMPLE_SCREEN_STATES,
  SYNTHETIC_LABEL,
  SeededRandom,
  createSyntheticDataset,
  describeDataset,
} from "./index.js";

describe("SeededRandom", () => {
  it("gives the same numbers for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    expect([a.next(), a.next(), a.int(1, 99)]).toEqual([
      b.next(),
      b.next(),
      b.int(1, 99),
    ]);
  });

  it("gives different numbers for another seed, and stays in range", () => {
    expect(new SeededRandom(1).next()).not.toBe(new SeededRandom(2).next());
    const r = new SeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const n = r.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
  });
});

describe("the synthetic dataset", () => {
  const data = createSyntheticDataset();

  it("is deterministic: the same seed gives identical data", () => {
    expect(createSyntheticDataset()).toEqual(data);
    expect(createSyntheticDataset({ seed: DEFAULT_SEED })).toEqual(data);
  });

  it("changes with the seed, but keeps its shape", () => {
    const other = createSyntheticDataset({ seed: 1 });
    expect(other).not.toEqual(data);
    expect(other.items.map((i) => i.no)).toEqual(data.items.map((i) => i.no));
    expect(other.orders.map((o) => o.sampleScreenState)).toEqual(
      data.orders.map((o) => o.sampleScreenState),
    );
  });

  it("is labelled, and returns fresh objects each time", () => {
    expect(data.label).toBe(SYNTHETIC_LABEL);
    expect(data.label).toBe("Synthetic demo data");
    const first = createSyntheticDataset();
    first.customers.length = 0;
    expect(createSyntheticDataset().customers).toHaveLength(5);
    expect(describeDataset(data)).toContain(
      "Synthetic demo data: 5 customers, 3 vendors, 30 items, 10 orders",
    );
  });

  it("has 5 customers in the brief's countries, 3 vendors, 30 items and 10 orders", () => {
    expect(data.customers).toHaveLength(5);
    expect(data.vendors).toHaveLength(3);
    expect(data.items).toHaveLength(30);
    expect(data.orders).toHaveLength(10);
    expect(data.customers.map((c) => c.countryRegionCode).sort()).toEqual([
      "AE",
      "BD",
      "IN",
      "LK",
      "PK",
    ]);
  });

  it("uses Navision's names and USD decimal strings", () => {
    expect(Object.keys(data.customers[0] ?? {}).sort()).toEqual([
      "balanceLcy",
      "countryRegionCode",
      "creditLimitLcy",
      "currencyCode",
      "customerPriceGroup",
      "name",
      "no",
      "paymentTermsCode",
    ]);
    for (const item of data.items) {
      for (const value of [
        item.unitPrice,
        item.unitCost,
        item.inventory,
        item.qtyOnSalesOrder,
        item.qtyOnPurchOrder,
      ]) {
        expect(decimalStringSchema.safeParse(value).success, value).toBe(true);
      }
      expect(compareDecimal(item.unitCost, item.unitPrice)).toBe(-1);
    }
    for (const order of data.orders) {
      expect(
        salesHeaderSchema.safeParse(order.header).success,
        order.header.no,
      ).toBe(true);
      for (const l of order.lines) {
        expect(salesLineSchema.safeParse(l).success).toBe(true);
      }
      expect(order.header.currencyCode).toBe("USD");
    }
  });

  it("links everything: each item has a vendor, each order a customer and real items", () => {
    const vendors = new Set(data.vendors.map((v) => v.no));
    const customers = new Set(data.customers.map((c) => c.no));
    const items = new Set(data.items.map((i) => i.no));
    expect(data.items.every((i) => vendors.has(i.vendorNo))).toBe(true);
    expect(
      data.orders.every((o) => customers.has(o.header.sellToCustomerNo)),
    ).toBe(true);
    expect(
      data.orders.every((o) => o.lines.every((l) => items.has(l.no))),
    ).toBe(true);
    expect(data.vendorBankAccounts.map((b) => b.vendorNo).sort()).toEqual(
      [...vendors].sort(),
    );
    expect(new Set(data.orders.map((o) => o.header.no)).size).toBe(10);
  });

  it("opens with stock and balances", () => {
    expect(compareDecimal(data.openingBalances.stockValueLcy, "0")).toBe(1);
    expect(compareDecimal(data.openingBalances.receivablesLcy, "0")).toBe(1);
    expect(compareDecimal(data.openingBalances.payablesLcy, "0")).toBe(1);
  });

  it("puts the orders in ten different sample screen states, none of them an order status", () => {
    expect(data.orders.map((o) => o.sampleScreenState)).toEqual([
      ...SAMPLE_SCREEN_STATES,
    ]);
    expect(SAMPLE_SCREEN_STATES.every((s) => s.startsWith("sample-"))).toBe(
      true,
    );
  });

  it("includes a short-stock order that suggests an SPR for the shortfall", () => {
    const scenario = data.orders.find(
      (o) => o.scenario.kind === "short-stock",
    )?.scenario;
    if (scenario?.kind !== "short-stock") throw new Error("missing");
    expect(scenario.shortBy).toBe("100.00");
    expect(scenario.suggestedSpr.quantity).toBe(scenario.shortBy);
    const item = data.items.find((i) => i.no === scenario.itemNo);
    if (!item) throw new Error("missing");
    expect(compareDecimal(item.inventory, scenario.ordered)).toBe(-1);
    expect(scenario.suggestedSpr.vendorNo).toBe(item.vendorNo);
  });

  it("includes an order waiting on payment, a packing-list mismatch and an overdue AWB", () => {
    const awaiting = data.orders.find(
      (o) => o.scenario.kind === "awaiting-payment",
    );
    expect(awaiting?.header.navisionStatus).toBe("Pending Prepayment");
    const mismatch = data.orders.find(
      (o) => o.scenario.kind === "packing-list-mismatch",
    );
    if (mismatch?.scenario.kind !== "packing-list-mismatch") {
      throw new Error("missing");
    }
    expect(mismatch.scenario.packed).not.toBe(mismatch.scenario.ordered);
    const overdue = data.orders.find((o) => o.scenario.kind === "awb-overdue");
    if (overdue?.scenario.kind !== "awb-overdue") throw new Error("missing");
    expect(overdue.header.packageTrackingNo).toBeNull();
    expect(overdue.scenario.dueDate < AS_OF).toBe(true);
    expect(overdue.scenario.daysOverdue).toBe(6);
  });

  it("looks fake: bank details that cannot be real, and no national ID numbers", () => {
    for (const bank of data.vendorBankAccounts) {
      expect(bank.iban.startsWith("ZZ")).toBe(true);
      expect(bank.swiftCode).toContain("DEMO");
      expect(bank.name).toContain("not a real bank");
    }
    expect(JSON.stringify(data)).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
  });
});
