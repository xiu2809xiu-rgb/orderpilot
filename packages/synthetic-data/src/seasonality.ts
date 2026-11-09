import type { CountryCode, ItemCategory } from "./types.js";

/**
 * How a category sells over the calendar year, January first, 1.0 being an
 * ordinary month. These are invented shapes, not Spectra's figures:
 * - PCs and peripherals rise for back-to-school in June to August, and again
 *   in the last quarter;
 * - components peak in the last quarter and dip in February;
 * - enterprise orders bunch at quarter ends;
 * - security is flat, and lumpy through `LUMPINESS`;
 * - networking is steady.
 */
export const SEASONALITY: Readonly<Record<ItemCategory, readonly number[]>> = {
  PCS: [0.9, 0.8, 0.8, 0.9, 1.0, 1.25, 1.4, 1.4, 1.1, 1.05, 1.15, 1.25],
  PERIPHERALS: [0.9, 0.85, 0.85, 0.9, 1.0, 1.2, 1.3, 1.3, 1.05, 1.05, 1.2, 1.3],
  COMPONENTS: [0.95, 0.7, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.05, 1.2, 1.35, 1.3],
  ENTERPRISE: [0.8, 0.85, 1.35, 0.8, 0.85, 1.3, 0.8, 0.85, 1.3, 0.85, 0.9, 1.4],
  SECURITY: [1.0, 0.95, 1.0, 1.0, 1.0, 1.05, 1.0, 1.0, 1.0, 1.05, 1.0, 0.95],
  NETWORKING: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
};

/** How much a month's sales vary around the curve, and how often one is empty. */
export const LUMPINESS: Readonly<
  Record<ItemCategory, { noise: number; empty: number }>
> = {
  PCS: { noise: 0.15, empty: 0 },
  PERIPHERALS: { noise: 0.15, empty: 0 },
  COMPONENTS: { noise: 0.15, empty: 0 },
  ENTERPRISE: { noise: 0.3, empty: 0.2 },
  SECURITY: { noise: 0.3, empty: 0.3 },
  NETWORKING: { noise: 0.06, empty: 0 },
};

/** Buyers in these countries order more in February and March (Ramadan, as a fixed window). */
export const RAMADAN_COUNTRIES: readonly CountryCode[] = [
  "AE",
  "PK",
  "BD",
  "MV",
  "ID",
  "MY",
];

/** Buyers in these countries order more in October and November (Diwali). */
export const DIWALI_COUNTRIES: readonly CountryCode[] = ["IN", "NP"];

/** How much more likely such a buyer is to be the one ordering in its months. */
export const FESTIVAL_WEIGHT = 3;

/**
 * How much a price falls in a month, by category: a price paid long ago was
 * higher, so each month before a pair's last order adds this share.
 */
export const PRICE_DRIFT: Readonly<Record<ItemCategory, number>> = {
  PCS: 0.003,
  PERIPHERALS: 0.003,
  COMPONENTS: 0.004,
  ENTERPRISE: 0.002,
  SECURITY: 0.003,
  NETWORKING: 0.002,
};

/** The weight of one buyer in one calendar month (0 is January). */
export function buyerWeight(
  country: CountryCode,
  calendarMonth: number,
): number {
  const ramadan = calendarMonth === 1 || calendarMonth === 2;
  const diwali = calendarMonth === 9 || calendarMonth === 10;
  if (ramadan && RAMADAN_COUNTRIES.includes(country)) return FESTIVAL_WEIGHT;
  if (diwali && DIWALI_COUNTRIES.includes(country)) return FESTIVAL_WEIGHT;
  return 1;
}
