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
