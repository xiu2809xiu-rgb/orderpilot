import { addDays, dateInMonth, historyMonths } from "./dates.js";
import { agreedPrice } from "./last-price.js";
import { SeededRandom, hashUnit } from "./random.js";
import {
  LUMPINESS,
  PRICE_DRIFT,
  SEASONALITY,
  buyerWeight,
} from "./seasonality.js";
import { availableStock } from "./stock.js";
import type { Customer, Item, SyntheticDataset } from "./types.js";

// The 24 months before the reference month, kept apart from the live orders: it
// is built on request, held per dataset object, and never part of the dataset
// itself, so no list, tracker or seed row reads it.

export interface HistoryLine {
  /** `H-YYYYMM-` and the customer's digits: one order a customer a month. */
  ref: string;
  date: string;
  month: string;
  customerNo: string;
  countryRegionCode: string;
  itemNo: string;
  brand: string;
  category: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

/** A vendor delivery: promised at the item's lead time, and up to 30 percent late. */
export interface HistoryReceipt {
  /** `HR-YYYYMM-` and the item's digits, for the month it was ordered. */
  ref: string;
  vendorNo: string;
  itemNo: string;
  brand: string;
  orderedOn: string;
  promisedOn: string;
  receivedOn: string;
  quantity: number;
}

export interface SalesHistory {
  /** Oldest first, ending the month before the reference month. */
  months: string[];
  lines: HistoryLine[];
  receipts: HistoryReceipt[];
}

export type HistoryGrouping =
  "brand" | "item" | "customer" | "country" | "category";

export interface LastAgreedPrice {
  price: string;
  agreedOn: string;
  documentNo: string;
}

const digitsOf = (no: string): string => no.slice(no.indexOf("-") + 1);

const cents = (value: string): number => Math.round(Number(value) * 100);
const fromCents = (value: number): string => (value / 100).toFixed(2);

/** Whole numbers in proportion to `weights` that add up to `total`, largest remainder first. */
function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? weights : weights.map(() => 1);
  const all = shares.reduce((a, b) => a + b, 0);
  const exact = shares.map((w) => (total * w) / all);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, at) => ({ at, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.at - b.at);
  for (const { at } of order) {
    if (left <= 0) break;
    parts[at] = (parts[at] ?? 0) + 1;
    left -= 1;
  }
  return parts;
}

interface Row {
  customer: Customer;
  at: number;
  quantity: number;
}

/** Units a month for one item: the last three months add up to exactly its sales. */
function monthlyUnits(
  item: Item,
  months: readonly string[],
  rng: SeededRandom,
): number[] {
  const total = Math.round(Number(item.runRate3m) * 3);
  const { noise, empty } = LUMPINESS[item.category];
  const curve = SEASONALITY[item.category];
  const count = months.length;
  const growth = (at: number): number => 1.06 ** ((at - (count - 1)) / 12);
  const shape = months.map((month, at) => {
    const base = (curve[Number(month.slice(5, 7)) - 1] ?? 1) * growth(at);
    const gone = empty > 0 && rng.next() < empty;
    const swing = 1 + noise * (2 * rng.next() - 1);
    const spike = empty > 0 ? 1 + 1.5 * rng.next() : 1;
    return { base, value: gone ? 0 : base * swing * spike };
  });
  const lastThree = shape.slice(-3);
  const usual = lastThree.reduce((s, m) => s + m.base, 0) / 3;
  const units = shape.map((m) => Math.round(((total / 3) * m.value) / usual));
  const split = apportion(
    total,
    lastThree.map((m) => m.value),
  );
  split.forEach((value, i) => {
    units[count - 3 + i] = value;
  });
  return units;
}

function itemRows(
  seed: number,
  item: Item,
  months: readonly string[],
  customers: readonly Customer[],
): Row[] {
  const rng = SeededRandom.child(seed, `history:${item.no}`);
  const units = monthlyUnits(item, months, rng);
  const buyers = customers
    .map((customer) => ({
      customer,
      rank: hashUnit(seed, "buyer", item.no, customer.no),
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 2 + Math.floor(7 * hashUnit(seed, "buyers", item.no)))
    .map((entry) => entry.customer);
  const rows: Row[] = [];
  units.forEach((quantity, at) => {
    if (quantity <= 0) return;
    const calendarMonth = Number(months[at]?.slice(5, 7)) - 1;
    const roll = rng.next();
    const wanted = Math.min(
      buyers.length,
      quantity,
      roll < 0.55 ? 1 : roll < 0.9 ? 2 : 3,
    );
    const pool = buyers.map((customer) => ({
      customer,
      weight: buyerWeight(customer.countryRegionCode, calendarMonth),
    }));
    const chosen: Customer[] = [];
    while (chosen.length < wanted) {
      let draw = rng.next() * pool.reduce((s, p) => s + p.weight, 0);
      let pick = 0;
      for (; pick < pool.length - 1; pick++) {
        draw -= pool[pick]?.weight ?? 0;
        if (draw < 0) break;
      }
      const [taken] = pool.splice(pick, 1);
      if (taken) chosen.push(taken.customer);
    }
    const shares = apportion(
      quantity - chosen.length,
      chosen.map(() => 0.5 + rng.next()),
    );
    chosen.forEach((customer, i) => {
      rows.push({ customer, at, quantity: 1 + (shares[i] ?? 0) });
    });
  });
  return rows;
}

function itemReceipts(
  seed: number,
  item: Item,
  months: readonly string[],
  reference: string,
): HistoryReceipt[] {
  const cadence = 2 + Math.floor(3 * hashUnit(seed, "cadence", item.no));
  const monthly = Number(item.runRate3m);
  const receipts: HistoryReceipt[] = [];
  for (
    let at = Math.floor(cadence * hashUnit(seed, "offset", item.no));
    at < months.length;
    at += cadence
  ) {
    const month = months[at] ?? "";
    const orderedOn = dateInMonth(
      month,
      1 + Math.floor(28 * hashUnit(seed, "ordered", item.no, at)),
    );
    const promisedOn = addDays(orderedOn, item.leadTimeDays);
    const late = Math.floor(
      item.leadTimeDays * 0.3 * hashUnit(seed, "late", item.no, at),
    );
    const receivedOn = addDays(promisedOn, late);
    if (receivedOn >= reference) continue;
    receipts.push({
      ref: `HR-${month.replace("-", "")}-${digitsOf(item.no)}`,
      vendorNo: item.vendorNo,
      itemNo: item.no,
      brand: item.brand,
      orderedOn,
      promisedOn,
      receivedOn,
      quantity: Math.max(1, Math.round(monthly * cadence)),
    });
  }
  return receipts;
}

function compareLines(a: HistoryLine, b: HistoryLine): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.ref !== b.ref) return a.ref < b.ref ? -1 : 1;
  return a.itemNo < b.itemNo ? -1 : 1;
}

function build(dataset: SyntheticDataset): SalesHistory {
  const months = historyMonths(dataset.asOf, 24);
  const lines: HistoryLine[] = [];
  const receipts: HistoryReceipt[] = [];
  for (const item of dataset.items) {
    const rows = itemRows(dataset.seed, item, months, dataset.customers);
    // Prices rise from month to month, so an older row was cheaper: each month
    // before the pair's last order takes the category's drift off, and the last
    // order stays at the agreed price.
    const lastAt = new Map<string, number>();
    for (const row of rows) lastAt.set(row.customer.no, row.at);
    for (const row of rows) {
      const month = months[row.at] ?? "";
      const behind = (lastAt.get(row.customer.no) ?? row.at) - row.at;
      const price = (
        Number(agreedPrice(dataset.seed, row.customer, item)) /
        (1 + PRICE_DRIFT[item.category]) ** behind
      ).toFixed(2);
      const day =
        1 +
        Math.floor(28 * hashUnit(dataset.seed, "day", row.customer.no, month));
      lines.push({
        ref: `H-${month.replace("-", "")}-${digitsOf(row.customer.no)}`,
        date: dateInMonth(month, day),
        month,
        customerNo: row.customer.no,
        countryRegionCode: row.customer.countryRegionCode,
        itemNo: item.no,
        brand: item.brand,
        category: item.category,
        quantity: row.quantity,
        unitPrice: price,
        amount: fromCents(row.quantity * cents(price)),
      });
    }
    receipts.push(...itemReceipts(dataset.seed, item, months, dataset.asOf));
  }
  lines.sort(compareLines);
  return { months, lines, receipts };
}

interface Memo {
  history: SalesHistory;
  latest?: Map<string, LastAgreedPrice>;
}

// The memo assumes the dataset object is never changed after it is made.
const memos = new WeakMap<SyntheticDataset, Memo>();

function memoOf(dataset: SyntheticDataset): Memo {
  let memo = memos.get(dataset);
  if (!memo) {
    memo = { history: build(dataset) };
    memos.set(dataset, memo);
  }
  return memo;
}

/**
 * The 24 months before the reference month, built the first time it is asked
 * for and kept for that dataset object. It is never part of the dataset.
 */
export function salesHistory(dataset: SyntheticDataset): SalesHistory {
  return memoOf(dataset).history;
}

/** Units and USD amounts for each month of the history, grouped by one dimension. */
export function monthlySales(
  history: SalesHistory,
  by: HistoryGrouping,
): Map<string, { units: number[]; amount: string[] }> {
  const slot = new Map(history.months.map((month, at) => [month, at]));
  const sums = new Map<string, { units: number[]; cents: number[] }>();
  for (const line of history.lines) {
    const key = {
      brand: line.brand,
      item: line.itemNo,
      customer: line.customerNo,
      country: line.countryRegionCode,
      category: line.category,
    }[by];
    let entry = sums.get(key);
    if (!entry) {
      entry = {
        units: history.months.map(() => 0),
        cents: history.months.map(() => 0),
      };
      sums.set(key, entry);
    }
    const at = slot.get(line.month) ?? 0;
    entry.units[at] = (entry.units[at] ?? 0) + line.quantity;
    entry.cents[at] = (entry.cents[at] ?? 0) + cents(line.amount);
  }
  return new Map(
    [...sums].map(([key, entry]) => [
      key,
      { units: entry.units, amount: entry.cents.map(fromCents) },
    ]),
  );
}

/** The inputs of a stock-cover view for one item; no rule is applied here. */
export function stockCover(
  dataset: SyntheticDataset,
  itemNo: string,
): {
  runRate3m: string;
  monthsOfCover: string | null;
  leadTimeDays: number;
  availableStock: string;
} | null {
  const item = dataset.items.find((candidate) => candidate.no === itemNo);
  if (!item) return null;
  return {
    runRate3m: item.runRate3m,
    monthsOfCover: item.monthsOfCover,
    leadTimeDays: item.leadTimeDays,
    availableStock: availableStock(item),
  };
}

function latestPrices(dataset: SyntheticDataset): Map<string, LastAgreedPrice> {
  const memo = memoOf(dataset);
  if (memo.latest) return memo.latest;
  const latest = new Map<string, LastAgreedPrice>();
  // A later date wins; on the same date a live order wins, because it was
  // placed after the month's history was closed.
  const offer = (key: string, next: LastAgreedPrice, live: boolean): void => {
    const held = latest.get(key);
    if (
      !held ||
      next.agreedOn > held.agreedOn ||
      (live && next.agreedOn === held.agreedOn)
    )
      latest.set(key, next);
  };
  for (const line of memo.history.lines) {
    offer(
      `${line.customerNo}|${line.itemNo}`,
      { price: line.unitPrice, agreedOn: line.date, documentNo: line.ref },
      false,
    );
  }
  for (const order of dataset.orders) {
    for (const line of order.lines) {
      offer(
        `${order.header.sellToCustomerNo}|${line.no}`,
        {
          price: line.unitPrice,
          agreedOn: order.header.orderDate,
          documentNo: order.header.no,
        },
        true,
      );
    }
  }
  memo.latest = latest;
  return latest;
}

/**
 * The price a customer last paid for an item, from the latest order line in
 * the history or the live orders. Null for a pair never bought: the data has
 * no price table, so there is nothing else to fall back on.
 */
export function lastAgreedPrice(
  dataset: SyntheticDataset,
  customerNo: string,
  itemNo: string,
): LastAgreedPrice | null {
  return latestPrices(dataset).get(`${customerNo}|${itemNo}`) ?? null;
}

/** The last agreed prices of one customer for several items, leaving out items never bought. */
export function lastAgreedPricesFor(
  dataset: SyntheticDataset,
  customerNo: string,
  itemNos: readonly string[],
): (LastAgreedPrice & { itemNo: string })[] {
  const prices = latestPrices(dataset);
  return itemNos.flatMap((itemNo) => {
    const found = prices.get(`${customerNo}|${itemNo}`);
    return found ? [{ itemNo, ...found }] : [];
  });
}
