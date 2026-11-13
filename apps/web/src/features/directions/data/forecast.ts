import { rootMeanSquare, round } from "./stats.ts";

// A seasonal naive forecast: each month ahead is expected to repeat the same
// month a year earlier. It is the plainest method that respects the seasons,
// so it is the one to beat and the one a person can check by eye. The range
// comes from how wrong the same method was on the months the history already
// holds, not from a formula about how the data ought to behave.

export const SEASON = 12;
/** 1.28 standard deviations either side holds about 80 percent of a normal spread. */
export const RANGE_MULTIPLIER = 1.28;

export interface ForecastPoint {
  month: string;
  forecast: number;
  low: number;
  high: number;
}

export interface Forecast {
  points: ForecastPoint[];
  /** The root mean square of the errors the method made on the history. */
  error: number;
  /** How many past months the error was measured on. */
  errorMonths: number;
}

/** `n` months after `month` (`YYYY-MM`). */
export function monthsAfter(month: string, n: number): string {
  const total =
    Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  const year = Math.floor(total / 12);
  return `${String(year)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Forecast `horizon` months after the history. `history` is oldest first, at
 * least two seasons long, and `lastMonth` is the month of its last value. The
 * forecast for a month is the value a season earlier; the range is that value
 * plus or minus the multiplier times the method's own error on the months
 * where a season-earlier value existed. A range never goes below zero.
 */
export function seasonalNaive(
  history: readonly number[],
  lastMonth: string,
  horizon = 6,
): Forecast {
  if (history.length < SEASON * 2) {
    throw new RangeError(
      "A seasonal forecast needs at least two seasons of history",
    );
  }
  if (horizon < 1 || horizon > SEASON) {
    throw new RangeError("The horizon is between 1 and 12 months");
  }
  const errors: number[] = [];
  for (let at = SEASON; at < history.length; at += 1) {
    errors.push((history[at] ?? 0) - (history[at - SEASON] ?? 0));
  }
  const error = rootMeanSquare(errors);
  const spread = RANGE_MULTIPLIER * error;
  const points = Array.from({ length: horizon }, (_, i): ForecastPoint => {
    const same = history[history.length - SEASON + i] ?? 0;
    return {
      month: monthsAfter(lastMonth, i + 1),
      forecast: round(same, 2),
      low: round(Math.max(0, same - spread), 2),
      high: round(same + spread, 2),
    };
  });
  return { points, error: round(error, 2), errorMonths: errors.length };
}
