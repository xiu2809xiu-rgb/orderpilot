import { daysBetween } from "./dates.js";
import type { SamplePriority } from "./types.js";

/**
 * A fixture rule that gives the screens a spread of priorities: high for work
 * well past due, very large, or marked to expedite (a customer asked), low for
 * small orders with nothing late. It is not a service level: Spectra has not
 * set one.
 */
export function priorityOf(
  total: string,
  dueOn: string | null,
  reference: string,
  expedite: boolean,
): SamplePriority {
  const amount = Number(total);
  const overdueDays = dueOn ? Math.max(0, daysBetween(dueOn, reference)) : 0;
  if (dueOn && expedite) return "high";
  if (overdueDays >= 3 || (overdueDays > 0 && amount >= 15_000)) return "high";
  if (dueOn && amount >= 40_000) return "high";
  if (amount < 3_000 && overdueDays === 0) return "low";
  return "normal";
}
