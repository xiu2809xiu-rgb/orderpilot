import type { RailTone } from "@/components/parts/journey";

export type { RailTone };

/**
 * The order's overall health, for the journey card's colour: critical when
 * it is overdue (the badge under the title already says so), warning when
 * something holds it (a shortage, or a failed check) but it has not yet run
 * out of time, normal otherwise. Overdue always wins: a held order that has
 * also run out of time is said as late, not merely held.
 */
export function orderTone(overdue: boolean, held: boolean): RailTone {
  if (overdue) return "critical";
  if (held) return "warning";
  return "normal";
}
