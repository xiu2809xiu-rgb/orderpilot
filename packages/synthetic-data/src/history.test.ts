import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  agreedPrice,
  createSyntheticDataset,
  historyMonths,
  lastAgreedPrice,
  lastAgreedPricesFor,
  monthlySales,
  salesHistory,
  stockCover,
  type SyntheticDataset,
} from "./index.js";
import { DIWALI_COUNTRIES, RAMADAN_COUNTRIES } from "./seasonality.js";

const data = createSyntheticDataset();
const history = salesHistory(data);
const inMonths = (units: readonly number[], calendar: readonly number[]) =>
  history.months.reduce(
    (sum, month, at) =>
      calendar.includes(Number(month.slice(5, 7)) - 1)
        ? sum + (units[at] ?? 0)
        : sum,
    0,
  );
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const variation = (units: readonly number[]): number => {
  const mean = units.reduce((a, b) => a + b, 0) / units.length;
  const spread = Math.sqrt(
    units.reduce((a, b) => a + (b - mean) ** 2, 0) / units.length,
  );
  return spread / mean;
};
const DAY_MS = 86_400_000;

describe("the 24 months of history", () => {
  it("is deterministic, and changes with the seed", () => {
    expect(JSON.stringify(salesHistory(createSyntheticDataset()))).toBe(
      JSON.stringify(history),
    );
    const other = salesHistory(createSyntheticDataset({ seed: 1 }));
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(history));
  });

  it("is built quickly, and only once for a dataset object", () => {
    const fresh = createSyntheticDataset();
    const started = performance.now();
    const built = salesHistory(fresh);
    expect(performance.now() - started).toBeLessThan(300);
    expect(salesHistory(fresh)).toBe(built);
  });

  it("stays out of the dataset, whose size does not grow with it", () => {
    expect(Object.keys(data)).not.toContain("history");
    expect(JSON.stringify(data)).not.toContain('"H-');
    expect(JSON.stringify(data).length).toBeLessThan(700_000);
    expect(data.orders).toHaveLength(120);
  });

  it("covers the 24 whole months before the reference month", () => {
    expect(history.months).toEqual(historyMonths("2026-11-02", 24));
    expect(history.months[0]).toBe("2024-11");
    expect(history.months[23]).toBe("2026-10");
    for (const line of history.lines) {
      expect(history.months).toContain(line.month);
      expect(line.date.startsWith(line.month)).toBe(true);
    }
  });

  it("is a few thousand lines, with its own references", () => {
    expect(history.lines.length).toBeGreaterThan(3_000);
    expect(history.lines.length).toBeLessThanOrEqual(15_000);
    for (const line of history.lines) {
      expect(line.ref).toBe(
        `H-${line.month.replace("-", "")}-${line.customerNo.slice(2)}`,
      );
      expect(line.ref).toMatch(/^H-\d{6}-\d{4}$/);
    }
    for (const receipt of history.receipts)
      expect(receipt.ref).toMatch(/^HR-\d{6}-\d{4}$/);
    const live = new Set(data.orders.map((order) => order.header.no));
    for (const line of history.lines) expect(live.has(line.ref)).toBe(false);
  });

  it("keeps every brand, category and country selling", () => {
    const active = (by: "brand" | "category" | "country") =>
      [...monthlySales(history, by)].map(([key, sales]) => ({
        key,
        months: sales.units.filter((units) => units > 0).length,
      }));
    expect(active("brand")).toHaveLength(22);
    for (const { key, months } of active("brand"))
      expect(months, key).toBeGreaterThanOrEqual(20);
    expect(active("category")).toHaveLength(6);
    for (const { key, months } of active("category"))
      expect(months, key).toBe(24);
    expect(active("country")).toHaveLength(11);
    for (const { key, months } of active("country"))
      expect(months, key).toBeGreaterThanOrEqual(12);
  });

  it("makes security lumpy and networking steady", () => {
    const sales = monthlySales(history, "item");
    const spread = (category: string) =>
      median(
        data.items
          .filter((item) => item.category === category)
          .map((item) => variation(sales.get(item.no)?.units ?? [])),
      );
    expect(spread("SECURITY")).toBeGreaterThan(0.5);
    expect(spread("NETWORKING")).toBeLessThan(0.35);
  });

  it("sells more PCs in the back-to-school months than in February and March", () => {
    const pcs = monthlySales(history, "category").get("PCS")?.units ?? [];
    const summer = inMonths(pcs, [5, 6, 7]) / 3;
    const trough = inMonths(pcs, [1, 2]) / 2;
    expect(summer).toBeGreaterThan(trough * 1.2);
  });

  it("shifts buyers toward the festival countries in their months", () => {
    const countries = monthlySales(history, "country");
    const share = (group: readonly string[], calendar: readonly number[]) => {
      let inside = 0;
      let all = 0;
      for (const [country, sales] of countries) {
        const units = inMonths(sales.units, calendar);
        all += units;
        if (group.includes(country)) inside += units;
      }
      return inside / all;
    };
    const rest = (calendar: readonly number[]) =>
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(
        (m) => !calendar.includes(m),
      );
    expect(share(RAMADAN_COUNTRIES, [1, 2])).toBeGreaterThan(
      share(RAMADAN_COUNTRIES, rest([1, 2])) + 0.1,
    );
    expect(share(DIWALI_COUNTRIES, [9, 10])).toBeGreaterThan(
      share(DIWALI_COUNTRIES, rest([9, 10])) + 0.05,
    );
  });

  it("adds the last three months up to each item's run rate", () => {
    const sales = monthlySales(history, "item");
    for (const item of data.items) {
      const units = sales.get(item.no)?.units ?? [];
      const lastThree = units.slice(-3).reduce((a, b) => a + b, 0);
      expect(lastThree, item.no).toBeGreaterThan(0);
      expect((lastThree / 3).toFixed(1), item.no).toBe(item.runRate3m);
    }
  });

  it("prices a pair's last row at the agreed price and earlier rows above it", () => {
    const lastOf = new Map<string, (typeof history.lines)[number]>();
    for (const line of history.lines)
      lastOf.set(`${line.customerNo}|${line.itemNo}`, line);
    for (const line of history.lines) {
      const last = lastOf.get(`${line.customerNo}|${line.itemNo}`);
      if (!last) throw new Error("no last row");
      expect(Number(line.unitPrice)).toBeGreaterThanOrEqual(
        Number(last.unitPrice),
      );
    }
    const sample = history.lines[history.lines.length - 1];
    const customer = data.customers.find((c) => c.no === sample?.customerNo);
    const item = data.items.find((i) => i.no === sample?.itemNo);
    if (!sample || !customer || !item) throw new Error("no sample");
    expect(lastOf.get(`${customer.no}|${item.no}`)?.unitPrice).toBe(
      agreedPrice(DEFAULT_SEED, customer, item),
    );
  });
});

describe("run rate, cover and lead times", () => {
  it("sets months of cover from the stock after the purchase orders", () => {
    for (const item of data.items) {
      expect(item.monthsOfCover, item.no).toBe(
        (Number(item.inventory) / Number(item.runRate3m)).toFixed(1),
      );
    }
  });

  it("keeps low-stock items short of cover unless an SPR's goods arrived", () => {
    const received = new Set(
      data.purchaseOrders
        .filter((po) => po.status === "received" && po.sprRecordNo)
        .flatMap((po) => po.lines.map((l) => l.no)),
    );
    const low = data.items.filter(
      (item, at) => at % 6 === 3 && !received.has(item.no),
    );
    expect(low.length).toBeGreaterThan(20);
    for (const item of low)
      expect(Number(item.monthsOfCover), item.no).toBeLessThan(1.5);
  });

  it("holds some components for less than the vendor's lead time", () => {
    const thin = data.items.filter(
      (item) =>
        item.category === "COMPONENTS" &&
        Number(item.monthsOfCover) * 30 < item.leadTimeDays,
    );
    expect(thin.length).toBeGreaterThan(5);
  });

  it("gives each vendor the median lead time of its items", () => {
    for (const vendor of data.vendors) {
      const days = data.items
        .filter((item) => item.vendorNo === vendor.no)
        .map((item) => item.leadTimeDays)
        .sort((a, b) => a - b);
      expect(days.length, vendor.no).toBeGreaterThan(0);
      expect(vendor.leadTimeDays, vendor.no).toBe(
        days.length % 2 === 1
          ? days[(days.length - 1) / 2]
          : Math.round(
              ((days[days.length / 2 - 1] ?? 0) +
                (days[days.length / 2] ?? 0)) /
                2,
            ),
      );
    }
  });

  it("promises each delivery at the lead time and lets it slip by up to 30 percent", () => {
    expect(history.receipts.length).toBeGreaterThan(500);
    const lead = new Map(data.items.map((i) => [i.no, i.leadTimeDays]));
    const slips = history.receipts.map((r) => {
      const days = lead.get(r.itemNo) ?? 1;
      expect(
        (Date.parse(r.promisedOn) - Date.parse(r.orderedOn)) / DAY_MS,
      ).toBe(days);
      expect(r.receivedOn < data.asOf).toBe(true);
      return (
        (Date.parse(r.receivedOn) - Date.parse(r.promisedOn)) / DAY_MS / days
      );
    });
    expect(Math.min(...slips)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...slips)).toBeLessThanOrEqual(0.3);
    expect(Math.max(...slips)).toBeGreaterThan(0.15);
  });

  it("gives the inputs of a stock cover view, and nothing for an unknown item", () => {
    const item = data.items[7];
    if (!item) throw new Error("no item");
    const cover = stockCover(data, item.no);
    expect(cover?.runRate3m).toBe(item.runRate3m);
    expect(cover?.monthsOfCover).toBe(item.monthsOfCover);
    expect(cover?.leadTimeDays).toBe(item.leadTimeDays);
    expect(cover?.availableStock).toMatch(/^-?\d+\.\d{2}$/);
    expect(stockCover(data, "I-9999")).toBeNull();
  });
});

describe("the last agreed price", () => {
  /** The latest line of a pair, found the slow way from the lines themselves. */
  function slowLatest(
    set: SyntheticDataset,
    customerNo: string,
    itemNo: string,
  ) {
    const rows = [
      ...salesHistory(set)
        .lines.filter((l) => l.customerNo === customerNo && l.itemNo === itemNo)
        .map((l) => ({ at: l.date, live: 0, price: l.unitPrice, doc: l.ref })),
      ...set.orders
        .filter((o) => o.header.sellToCustomerNo === customerNo)
        .flatMap((o) =>
          o.lines
            .filter((l) => l.no === itemNo)
            .map((l) => ({
              at: o.header.orderDate,
              live: 1,
              price: l.unitPrice,
              doc: o.header.no,
            })),
        ),
    ].sort((a, b) => (a.at === b.at ? b.live - a.live : a.at < b.at ? 1 : -1));
    return rows[0] ?? null;
  }

  it("equals the latest line of a full build, for every pair", () => {
    let found = 0;
    for (const customer of data.customers) {
      for (const item of data.items.slice(0, 40)) {
        const expected = slowLatest(data, customer.no, item.no);
        const actual = lastAgreedPrice(data, customer.no, item.no);
        if (!expected) {
          expect(actual).toBeNull();
          continue;
        }
        found++;
        expect(actual).toEqual({
          price: expected.price,
          agreedOn: expected.at,
          documentNo: expected.doc,
        });
      }
    }
    expect(found).toBeGreaterThan(50);
  });

  it("is sparse: a pair never bought has no price", () => {
    const nothing = data.customers.flatMap((c) =>
      data.items.filter((i) => lastAgreedPrice(data, c.no, i.no) === null),
    );
    expect(nothing.length).toBeGreaterThan(0);
  });

  it("lists the priced items of one customer and leaves the others out", () => {
    const customer = data.customers[0];
    if (!customer) throw new Error("no customer");
    const itemNos = data.items.map((i) => i.no);
    const rows = lastAgreedPricesFor(data, customer.no, itemNos);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(itemNos.length);
    for (const row of rows)
      expect(lastAgreedPrice(data, customer.no, row.itemNo)).toEqual({
        price: row.price,
        agreedOn: row.agreedOn,
        documentNo: row.documentNo,
      });
  });

  it("moves the window by a month across a month end and moves no live price", () => {
    const earlier = createSyntheticDataset({ referenceDate: "2026-11-23" });
    const later = createSyntheticDataset({ referenceDate: "2026-12-02" });
    expect(salesHistory(earlier).months[23]).toBe("2026-10");
    expect(salesHistory(later).months[23]).toBe("2026-11");
    for (const customer of earlier.customers.slice(0, 20)) {
      for (const item of earlier.items.slice(0, 20)) {
        const other = later.items.find((i) => i.no === item.no);
        if (!other) throw new Error(item.no);
        expect(agreedPrice(DEFAULT_SEED, customer, other)).toBe(
          agreedPrice(DEFAULT_SEED, customer, item),
        );
      }
    }
  });
});
