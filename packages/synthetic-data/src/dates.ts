// Dates are plain `YYYY-MM-DD` strings. Every date in the dataset is worked out
// from one reference date, so nothing here reads a clock except
// `todayInSingapore`, which the callers at run time use to pick that date.

const DAY_MS = 86_400_000;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      DAY_MS,
  );
}

/** Today's date in Asia/Singapore, which is when OrderPilot's working day turns over. */
export function todayInSingapore(now: Date = new Date()): string {
  return new Date(now.getTime() + SINGAPORE_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** A moment on `date`, at `hour` UTC (1 to 10 UTC is 9 to 18 in Singapore). */
export function atHour(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

/** The month of a date, as `YYYY-MM`. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** A month `n` months after `month` (before, when `n` is negative). */
export function addMonths(month: string, n: number): string {
  const total =
    Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + n;
  const year = Math.floor(total / 12);
  return `${String(year)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * The `count` whole months before the month of `reference`, oldest first. The
 * month of the reference date is left out because it is not over yet.
 */
export function historyMonths(reference: string, count = 24): string[] {
  const last = addMonths(monthOf(reference), -1);
  return Array.from({ length: count }, (_, i) =>
    addMonths(last, i + 1 - count),
  );
}

/** A date in `month`, with a day past the end of the month held to its last day. */
export function dateInMonth(month: string, day: number): string {
  const last = Number(addDays(`${addMonths(month, 1)}-01`, -1).slice(8, 10));
  return `${month}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
}
