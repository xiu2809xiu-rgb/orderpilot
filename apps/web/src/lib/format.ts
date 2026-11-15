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

// en-CA writes a date as 2026-11-15, which Date.UTC can read back.
const SG_DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Singapore",
});

function singaporeDayNumber(value: Date): number {
  const [year = 0, month = 1, day = 1] = SG_DATE.format(value)
    .split("-")
    .map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * How many calendar days in Singapore lie between two moments (`later` minus
 * `earlier`), so that a task due at 5 pm on the 12th is 3 days late at any
 * time on the 15th. The order and tracker pages count lateness this way, and
 * the home rows use the same count, so one task reads the same everywhere.
 */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  return singaporeDayNumber(later) - singaporeDayNumber(earlier);
}

/** "Monday, 2 November 2026" in Singapore time. */
export function formatLongDay(value: Date): string {
  return LONG_DAY.format(value);
}

const DAY_TIME = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

/** "2 Nov 2026, 9:15 am" in Singapore time. */
export function formatDayTime(value: string | Date): string {
  return DAY_TIME.format(typeof value === "string" ? new Date(value) : value);
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
