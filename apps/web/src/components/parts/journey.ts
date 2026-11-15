import {
  PURCHASE_STEP_IDS,
  SALES_STEP_IDS,
} from "../../features/directions/data/estimates";

export type Flow = "sales" | "purchase";
export type JourneyState = "done" | "now" | "later";

export const STEP_IDS: Record<Flow, readonly string[]> = {
  sales: SALES_STEP_IDS,
  purchase: PURCHASE_STEP_IDS,
};

/**
 * The state of step `position` (1 to 9) when the order is at `current`:
 * earlier steps are done, the current one is now, later ones wait. A current
 * past the last step means every step is done.
 */
export function stateOf(position: number, current: number): JourneyState {
  if (position < current) return "done";
  return position === current ? "now" : "later";
}
