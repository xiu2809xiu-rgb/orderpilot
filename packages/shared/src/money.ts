import { z } from "zod";

/** USD amounts and quantities are decimal strings like "1250.50". Never a float. */
export const DECIMAL_PATTERN = /^-?\d{1,15}(\.\d{1,4})?$/;

export const decimalStringSchema = z
  .string()
  .regex(DECIMAL_PATTERN, "Use a decimal string such as 1250.50");
export type DecimalString = z.infer<typeof decimalStringSchema>;

export const USD = "USD" as const;

const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

function toUnits(value: string): bigint {
  if (!DECIMAL_PATTERN.test(value))
    throw new RangeError(`Not a decimal string: ${value}`);
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const units = BigInt(whole) * FACTOR + BigInt(fraction.padEnd(SCALE, "0"));
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = (abs / FACTOR).toString();
  let fraction = (abs % FACTOR).toString().padStart(SCALE, "0");
  // Keep two decimals at least, and drop trailing zeros beyond that.
  while (fraction.length > 2 && fraction.endsWith("0"))
    fraction = fraction.slice(0, -1);
  const text = `${whole}.${fraction}`;
  return negative && abs !== 0n ? `-${text}` : text;
}

/** Exact addition on decimal strings. */
export function addDecimal(a: string, b: string): string {
  return fromUnits(toUnits(a) + toUnits(b));
}

/** Exact multiplication, rounded half away from zero to four decimals. */
export function multiplyDecimal(a: string, b: string): string {
  const product = toUnits(a) * toUnits(b);
  const half = FACTOR / 2n;
  const rounded =
    product >= 0n ? (product + half) / FACTOR : (product - half) / FACTOR;
  return fromUnits(rounded);
}

/** An amount as it is paid: rounded half away from zero to two decimals. */
export function roundToCents(value: string): string {
  const cent = FACTOR / 100n;
  const units = toUnits(value);
  const half = cent / 2n;
  const whole = (units >= 0n ? units + half : units - half) / cent;
  return fromUnits(whole * cent);
}

/** -1, 0 or 1. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const x = toUnits(a);
  const y = toUnits(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Exact subtraction on decimal strings: `a` minus `b`. */
export function subtractDecimal(a: string, b: string): string {
  return fromUnits(toUnits(a) - toUnits(b));
}

/**
 * Exact sum of any number of decimal strings. It adds in whole units and
 * converts once, so a long list can never be refused for the size of its
 * running total.
 */
export function sumDecimal(values: readonly string[]): string {
  return fromUnits(values.reduce((total, value) => total + toUnits(value), 0n));
}

/** True when the text is a decimal string this module can compute with. */
export function isDecimalString(text: string): boolean {
  return DECIMAL_PATTERN.test(text);
}

/**
 * What a line costs: the quantity times the unit price, as it is paid, to the
 * cent. Null while either one is empty or half typed ("3." or "abc"), so a
 * screen can show a blank amount instead of a wrong one as someone types. Null
 * too when two valid numbers give a product this module cannot hold (more than
 * 15 whole digits): see `isLineAmountTooLarge`.
 */
export function lineAmount(quantity: string, unitPrice: string): string | null {
  if (!isDecimalString(quantity) || !isDecimalString(unitPrice)) return null;
  const product = multiplyDecimal(quantity, unitPrice);
  // roundToCents would refuse a product past the pattern with a RangeError.
  if (!isDecimalString(product)) return null;
  const amount = roundToCents(product);
  // Rounding up can add a digit (999999999999999.99995 becomes 10^15).
  return isDecimalString(amount) ? amount : null;
}

/** True when both are decimal strings but their product is too large to hold. */
export function isLineAmountTooLarge(
  quantity: string,
  unitPrice: string,
): boolean {
  return (
    isDecimalString(quantity) &&
    isDecimalString(unitPrice) &&
    lineAmount(quantity, unitPrice) === null
  );
}

/**
 * By how much a quantity is more than what is available, or null when the
 * available stock covers it (or either is not a decimal string).
 */
export function shortfallOf(needed: string, available: string): string | null {
  if (!isDecimalString(needed) || !isDecimalString(available)) return null;
  return compareDecimal(needed, available) > 0
    ? subtractDecimal(needed, available)
    : null;
}
