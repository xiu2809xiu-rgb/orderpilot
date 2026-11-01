const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2026-10-30` as `30 Oct 2026`, the way a trading document writes it. */
export function printDate(iso: string): string {
  const [year = "", month = "", day = ""] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!name) throw new RangeError(`Not a date: ${iso}`);
  return `${day} ${name} ${year}`;
}

/** `1250.5` as `1,250.50`. Strings in, strings out: money is never a float here. */
export function printMoney(decimal: string): string {
  const negative = decimal.startsWith("-");
  const [whole = "0", fraction = ""] = decimal.replace("-", "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "-" : ""}${grouped}.${cents}`;
}

/** A quantity with no trailing `.0000`. */
export function printQuantity(decimal: string): string {
  const [whole = "0", fraction = ""] = decimal.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

/** A decimal string rounded half up to two decimals. Amounts here are never negative. */
export function toCents(decimal: string): string {
  const [whole = "0", fraction = ""] = decimal.split(".");
  const digits = fraction.padEnd(3, "0");
  const cents =
    BigInt(whole) * 100n +
    BigInt(digits.slice(0, 2)) +
    (digits.charAt(2) >= "5" ? 1n : 0n);
  const text = cents.toString().padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}
