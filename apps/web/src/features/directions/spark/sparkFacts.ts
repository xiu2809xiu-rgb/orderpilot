import { SALES_HISTORY, STOCK_ANSWER } from "../data/index";
import type { History, StockAnswer, StockItem } from "../data/types";

/** The figures behind Spark's stock answer, read from the generated data file. */
export interface StockFacts {
  brand: string;
  items: readonly StockItem[];
  totals: StockAnswer["totals"];
  /** The first item, when there is exactly one: the answer names it. */
  only: StockItem | null;
  otherBrands: StockAnswer["otherBrands"];
}

/**
 * What can be promised to a customer today: on hand, less what sales orders
 * already hold. The stock still on purchase orders is due, not here, so it is
 * kept apart (the table's Available column adds it).
 */
export function availableNow(
  item: Pick<StockItem, "onHand" | "onSalesOrders">,
): number {
  return item.onHand - item.onSalesOrders;
}

export function stockFacts(data: StockAnswer = STOCK_ANSWER): StockFacts {
  return {
    brand: data.brand,
    items: data.items,
    totals: data.totals,
    only: data.items.length === 1 ? (data.items[0] ?? null) : null,
    otherBrands: data.otherBrands,
  };
}

export interface MonthPoint {
  /** "2026-10" */
  month: string;
  amountUsd: number;
  /** Set on a forecast month: the range the method gives. */
  range?: { low: number; high: number };
  forecast: boolean;
}

/** The figures behind Spark's trend answer: 12 months seen, 6 months forecast. */
export interface TrendFacts {
  last12: number;
  prior12: number;
  /** last12 against prior12, as a fraction: 0.04 is 4 percent higher. */
  change: number;
  forecastTotal: number;
  points: readonly MonthPoint[];
  method: string;
}

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

export function trendFacts(history: History = SALES_HISTORY): TrendFacts {
  const amounts = history.total.amountUsd;
  const seen = history.months.slice(-12).map((month, index): MonthPoint => ({
    month,
    amountUsd: amounts.slice(-12)[index] ?? 0,
    forecast: false,
  }));
  const ahead = history.forecast.amountUsd.map((point): MonthPoint => ({
    month: point.month,
    amountUsd: point.forecast,
    range: { low: point.low, high: point.high },
    forecast: true,
  }));
  const last12 = sum(amounts.slice(-12));
  const prior12 = sum(amounts.slice(-24, -12));
  return {
    last12,
    prior12,
    change: prior12 === 0 ? 0 : (last12 - prior12) / prior12,
    forecastTotal: sum(ahead.map((point) => point.amountUsd)),
    points: [...seen, ...ahead],
    method: history.forecast.method,
  };
}

const MONTH = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

/** "Oct" from "2026-10". */
export function monthName(month: string): string {
  return MONTH.format(new Date(`${month}-01T00:00:00Z`));
}

/** "162.4" from 162,386,000: USD in millions, one decimal. */
export function millions(value: number): string {
  return (value / 1_000_000).toFixed(1);
}

/** "1,020" with thousands grouped. */
export function grouped(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
