import { DECIMAL_PATTERN } from "@orderpilot/shared";

/**
 * "USD 12,340.00" from a decimal string such as "12340". The digits are only
 * regrouped as text: no number is parsed, so nothing is rounded and a long
 * amount keeps every digit. At least two decimals, and no more than the value
 * carries. A value that is not a decimal string is shown as it came.
 */
export function formatMoney(value: string, currency = "USD"): string {
  if (!DECIMAL_PATTERN.test(value)) return `${currency} ${value}`;
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let decimals = fraction.padEnd(2, "0");
  while (decimals.length > 2 && decimals.endsWith("0")) {
    decimals = decimals.slice(0, -1);
  }
  const isZero = /^0*$/.test(whole) && /^0*$/.test(fraction);
  return `${currency} ${negative && !isZero ? "-" : ""}${grouped}.${decimals}`;
}

/**
 * "1,234" from a quantity such as "1234.00", and "2.5" from "2.50". Regrouped
 * as text, like an amount: nothing is parsed, so nothing is rounded.
 */
export function formatQuantity(value: string): string {
  if (!DECIMAL_PATTERN.test(value)) return value;
  const [whole = "0", fraction = ""] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimals = fraction.replace(/0+$/, "");
  return decimals ? `${grouped}.${decimals}` : grouped;
}

const DAY = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Singapore",
});

const LONG_DAY = new Intl.DateTimeFormat("en-SG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Singapore",
});

/** "Monday, 2 November 2026" in Singapore time. */
export function formatLongDay(value: Date): string {
  return LONG_DAY.format(value);
}

const ISO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Singapore",
});

/** "2026-11-02": today's date in Singapore, as an API date. */
export function todayInSingapore(now = new Date()): string {
  return ISO_DAY.format(now);
}

/** "2 Nov 2026" in Singapore time: the one short date used in tables. */
export function formatDay(value: string | Date): string {
  return DAY.format(typeof value === "string" ? new Date(value) : value);
}
