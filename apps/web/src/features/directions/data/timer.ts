// How far a due time is from now, as one whole number in one unit: "3 h",
// "2 days". The wording lives in the locale files; this only does the sums.

import { todayInSingapore } from "@/lib/format";

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

export interface WaitParts {
  unit: "minutes" | "hours" | "days";
  amount: number;
}

/**
 * How long something has waited since `since`, in words a person counts the
 * same way on every screen. A wait that began on a day other than today (in
 * Singapore) is counted in calendar days, the way the order's page counts it,
 * so the two give one figure for one start day. A wait that began today is in
 * hours, or minutes under an hour, because "today" says no more than that.
 * Whole 24-hour blocks gave a day fewer for most of every day: a wait that
 * began at 16:00 four days ago is five days on the calendar from midnight on.
 */
export function waitParts(since: Date, now: Date): WaitParts {
  const days = calendarDaysBetween(since, now);
  if (days >= 1) return { unit: "days", amount: days };
  const span = Math.max(0, now.getTime() - since.getTime());
  if (span < HOUR)
    return { unit: "minutes", amount: Math.round(span / MINUTE) };
  return { unit: "hours", amount: Math.round(span / HOUR) };
}

/** Whole days between two moments on Singapore's calendar; never below zero. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const dayNumber = (date: Date): number =>
    Math.round(Date.parse(`${todayInSingapore(date)}T00:00:00.000Z`) / DAY);
  return Math.max(0, dayNumber(to) - dayNumber(from));
}
