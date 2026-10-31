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

const DAY = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Singapore",
});

/** "2 Nov 2026" in Singapore time: the one short date used in tables. */
export function formatDay(value: string | Date): string {
  return DAY.format(typeof value === "string" ? new Date(value) : value);
}
