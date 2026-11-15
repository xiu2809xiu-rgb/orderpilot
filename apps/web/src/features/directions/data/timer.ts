// How far a due time is from now, as one whole number in one unit: "3 h",
// "2 days". The wording lives in the locale files; this only does the sums.

export type TimerUnit = "now" | "minutes" | "hours" | "days";
export type TimerTone = "late" | "soon" | "later";

export interface TimerParts {
  late: boolean;
  unit: TimerUnit;
  amount: number;
  tone: TimerTone;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Due within this many hours counts as soon. */
export const SOON_HOURS = 4;

export function timerParts(due: Date, now: Date): TimerParts {
  const delta = due.getTime() - now.getTime();
  const late = delta < 0;
  const span = Math.abs(delta);
  let unit: TimerUnit;
  let amount: number;
  if (span < MINUTE) {
    unit = "now";
    amount = 0;
  } else if (span < HOUR) {
    unit = "minutes";
    amount = Math.round(span / MINUTE);
  } else if (span < 2 * DAY) {
    unit = "hours";
    amount = Math.round(span / HOUR);
  } else {
    unit = "days";
    amount = Math.floor(span / DAY);
  }
  const tone: TimerTone = late
    ? "late"
    : delta <= SOON_HOURS * HOUR
      ? "soon"
      : "later";
  return { late, unit, amount, tone };
}
