// Plain statistics for the preview's estimates. No imports on purpose: the
// data script (apps/web/scripts/directions-data.mjs) runs this file with Node
// itself, so the figures on screen and the figures in the JSON come from one
// piece of code.

/** The q-th quantile (0 to 1) of a list, by linear interpolation. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new RangeError("No values to measure");
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const below = Math.floor(at);
  const above = Math.ceil(at);
  const lo = sorted[below] ?? 0;
  const hi = sorted[above] ?? lo;
  return lo + (hi - lo) * (at - below);
}

export const median = (values: readonly number[]): number =>
  quantile(values, 0.5);

/** The square root of the mean of the squares: a size of error that counts a bias too. */
export function rootMeanSquare(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("No values to measure");
  return Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
}

/** Round to a number of decimals, without a trailing `-0`. */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}
