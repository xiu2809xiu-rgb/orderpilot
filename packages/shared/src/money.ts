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

/** -1, 0 or 1. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const x = toUnits(a);
  const y = toUnits(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
