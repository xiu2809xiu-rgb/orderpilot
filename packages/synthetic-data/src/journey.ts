import { addDays } from "./dates.js";
import type { SeededRandom } from "./random.js";
import { SAMPLE_SCREEN_STATES, type SampleScreenState } from "./types.js";

/**
 * The days an order lived through, worked out before anything else is built.
 * Dates, documents, payments, SPRs and tasks all read from here, so they agree.
 * The names are fixture steps for the demo, not the state machine's.
 */
export const MILESTONES = [
  "fields",
  "stock",
  "approved",
  "pi",
  "paid",
  "packed",
  "shipped",
  "invoiced",
  "closed",
] as const;
export type Milestone = (typeof MILESTONES)[number];

/** Days each milestone takes after the one before it, as a range. */
const GAP: Readonly<Record<Milestone, readonly [number, number]>> = {
  fields: [0, 1],
  stock: [0, 2],
  approved: [0, 1],
  pi: [1, 2],
  paid: [2, 6],
  packed: [2, 5],
  shipped: [1, 3],
  invoiced: [1, 4],
  closed: [8, 22],
};

interface StatePlan {
  readonly count: number;
  /** The last milestone done when the order reaches the state, or null. */
  readonly after: Milestone | null;
  /** How long it has been in the state, in days. */
  readonly inState: readonly [number, number];
  /** Days after entering the state that its work falls due (a fixture, not a service level). */
  readonly dueAfter: readonly [number, number] | null;
}

// More orders in the middle of the flow than at its ends, closed ones last.
export const STATE_PLAN: Readonly<Record<SampleScreenState, StatePlan>> = {
  "sample-po-received": {
    count: 6,
    after: null,
    inState: [0, 1],
    dueAfter: [1, 1],
  },
  "sample-extracted-awaiting-review": {
    count: 8,
    after: null,
    inState: [0, 3],
    dueAfter: [2, 3],
  },
  "sample-short-stock": {
    count: 12,
    after: "fields",
    inState: [0, 5],
    dueAfter: [3, 4],
  },
  "sample-pending-approval": {
    count: 10,
    after: "stock",
    inState: [0, 5],
    dueAfter: [3, 5],
  },
  "sample-pi-to-send": {
    count: 8,
    after: "approved",
    inState: [0, 5],
    dueAfter: [3, 4],
  },
  "sample-awaiting-payment": {
    count: 14,
    after: "pi",
    inState: [0, 10],
    dueAfter: [6, 9],
  },
  "sample-ready-to-pick": {
    count: 14,
    after: "paid",
    inState: [0, 8],
    dueAfter: [5, 7],
  },
  "sample-packing-list-mismatch": {
    count: 6,
    after: "packed",
    inState: [0, 6],
    dueAfter: [4, 6],
  },
  "sample-awb-overdue": {
    count: 6,
    after: "shipped",
    inState: [4, 14],
    dueAfter: [3, 3],
  },
  "sample-shipped": {
    count: 12,
    after: "shipped",
    inState: [0, 12],
    dueAfter: [8, 12],
  },
  "sample-invoiced": {
    count: 10,
    after: "invoiced",
    inState: [0, 38],
    dueAfter: [30, 30],
  },
  "sample-closed": {
    count: 14,
    after: "closed",
    inState: [0, 22],
    dueAfter: null,
  },
};

/** The sample window: orders are placed over this many days up to the reference date. */
export const WINDOW_DAYS = 60;

export interface Journey {
  state: SampleScreenState;
  /** Position among the orders in the same state. */
  indexInState: number;
  ageDays: number;
  orderDate: string;
  enteredOn: string;
  dueOn: string | null;
  /** The day each milestone was done; later ones are missing. */
  done: Partial<Record<Milestone, string>>;
  /** True when a line is short on stock, so an SPR follows. */
  hasSpr: boolean;
}

/** Whether a state's orders have a stock purchase request, by position, so the count is exact. */
function hasSpr(state: SampleScreenState, index: number): boolean {
  if (state === "sample-short-stock" || state === "sample-pending-approval") {
    return true;
  }
  const later = SAMPLE_SCREEN_STATES.indexOf(state) >= 4;
  return later && index % 4 === 0;
}

function between(random: SeededRandom, [lo, hi]: readonly [number, number]) {
  return random.int(lo, hi);
}

function planOne(
  random: SeededRandom,
  reference: string,
  state: SampleScreenState,
  indexInState: number,
): Journey {
  const plan = STATE_PLAN[state];
  const sprPath = hasSpr(state, indexInState);
  const offsets: Partial<Record<Milestone, number>> = {};
  let day = 0;
  const last = plan.after ? MILESTONES.indexOf(plan.after) : -1;
  for (const [i, milestone] of MILESTONES.entries()) {
    if (i > last) break;
    // Approval is a step only for orders with a stock purchase request.
    if (milestone === "approved" && !sprPath) continue;
    day += between(random, GAP[milestone]);
    offsets[milestone] = day;
  }
  const wanted = between(random, plan.inState);
  const inState = Math.max(0, Math.min(wanted, WINDOW_DAYS - day));
  const ageDays = day + inState;
  const orderDate = addDays(reference, -ageDays);
  const done: Partial<Record<Milestone, string>> = {};
  for (const [milestone, offset] of Object.entries(offsets)) {
    done[milestone as Milestone] = addDays(orderDate, offset);
  }
  const enteredOn = addDays(orderDate, day);
  return {
    state,
    indexInState,
    ageDays,
    orderDate,
    enteredOn,
    dueOn: plan.dueAfter
      ? addDays(enteredOn, between(random, plan.dueAfter))
      : null,
    done,
    hasSpr: sprPath,
  };
}

/** Every order's journey, oldest first, so order numbers run with the calendar. */
export function planJourneys(
  random: SeededRandom,
  reference: string,
): Journey[] {
  const journeys: Journey[] = [];
  for (const state of SAMPLE_SCREEN_STATES) {
    for (let i = 0; i < STATE_PLAN[state].count; i++) {
      journeys.push(planOne(random, reference, state, i));
    }
  }
  const stateRank = (j: Journey) => SAMPLE_SCREEN_STATES.indexOf(j.state);
  return journeys.sort(
    (a, b) =>
      b.ageDays - a.ageDays ||
      stateRank(b) - stateRank(a) ||
      a.indexInState - b.indexInState,
  );
}
