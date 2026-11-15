import type { StepStat, StepTime } from "./types";

// Estimates for a step and for an order, worked out from the step-times file:
// real arithmetic on how long orders took, never a guess. Where the data
// cannot support a number, every function here answers null and the screen
// shows no number.

/** The nine sales steps in the client's order; the tracker's keys. */
export const SALES_STEP_IDS = [
  "poIn",
  "stock",
  "pi",
  "payment",
  "pack",
  "documents",
  "forwarder",
  "customerTold",
  "awbAndPermit",
] as const;
export type SalesStepId = (typeof SALES_STEP_IDS)[number];

/** The nine steps of a purchase, in the client's order. The tracker has no purchase flow yet. */
export const PURCHASE_STEP_IDS = [
  "spr",
  "approval",
  "vendorPo",
  "vendorPi",
  "forwarder",
  "goodsCheck",
  "goodsReceived",
  "customerTold",
  "vendorPaid",
] as const;
export type PurchaseStepId = (typeof PURCHASE_STEP_IDS)[number];

/** The step whose completion is the goods leaving. */
export const SHIP_STEP: SalesStepId = "forwarder";

const DAY_MS = 86_400_000;

/** The measured figures of a step, or null when it is left out. */
export function statOf(
  steps: readonly StepTime[],
  id: string,
): StepStat | null {
  const step = steps.find((candidate) => candidate.id === id);
  if (
    !step?.measured ||
    (step.unit !== "days" && step.unit !== "hours") ||
    step.median === null ||
    step.p25 === null ||
    step.p75 === null
  ) {
    return null;
  }
  return {
    unit: step.unit,
    n: step.n,
    p25: step.p25,
    median: step.median,
    p75: step.p75,
  };
}

/** What a step usually takes, in words a screen can put through i18n. */
export type Usual =
  | { kind: "sameDay" }
  | { kind: "hours"; amount: number }
  | { kind: "days"; amount: number };

export function usualDuration(stat: StepStat): Usual {
  if (stat.unit === "hours") {
    const hours = Math.round(stat.median);
    if (hours >= 48) return { kind: "days", amount: Math.round(hours / 24) };
    return hours < 1 ? { kind: "sameDay" } : { kind: "hours", amount: hours };
  }
  const days = Math.round(stat.median);
  return days < 1 ? { kind: "sameDay" } : { kind: "days", amount: days };
}

export interface ExpectedBy {
  at: Date;
  /** A step measured in hours has a time of day; one in days has only a day. */
  precision: "time" | "day";
}

/**
 * When a step that began at `since` should be done, if it takes as long as it
 * usually does. A step measured in days gives a day, never a made-up hour.
 */
export function expectedBy(since: Date, stat: StepStat): ExpectedBy {
  if (stat.unit === "hours") {
    return {
      at: new Date(since.getTime() + stat.median * 3_600_000),
      precision: "time",
    };
  }
  return {
    at: new Date(since.getTime() + Math.ceil(stat.median) * DAY_MS),
    precision: "day",
  };
}

const dayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00.000Z`) / DAY_MS);

const addDays = (date: string, days: number): string =>
  new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

export interface ShipEstimate {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Whole days from today. */
  inDays: number;
  /** The steps whose usual time went into the date. */
  basedOn: string[];
  /** Steps from here to shipping that the data cannot time, so they add nothing. */
  missing: string[];
  /** The current step has already run past its usual time. */
  late: boolean;
}

/**
 * The expected ship date of a sales order: what is left of the current step's
 * usual time, plus the usual time of every step after it up to the goods
 * leaving. Dates are the data's whole days, so the answer is a day. Null when
 * the order is past shipping, or when no step on the way can be timed.
 */
export function expectedShipDate(input: {
  steps: readonly StepTime[];
  currentStep: string;
  /** The day the order reached the current step. */
  enteredOn: string;
  today: string;
}): ShipEstimate | null {
  const { steps, currentStep, enteredOn, today } = input;
  const at = SALES_STEP_IDS.findIndex((id) => id === currentStep);
  const ship = SALES_STEP_IDS.indexOf(SHIP_STEP);
  if (at < 0 || at > ship) return null;
  const basedOn: string[] = [];
  const missing: string[] = [];
  let total = 0;
  let late = false;
  for (const id of SALES_STEP_IDS.slice(at, ship + 1)) {
    const stat = statOf(steps, id);
    if (!stat) {
      missing.push(id);
      continue;
    }
    basedOn.push(id);
    if (id === currentStep) {
      const waited = Math.max(0, dayNumber(today) - dayNumber(enteredOn));
      late = waited > stat.median;
      total += Math.max(0, stat.median - waited);
    } else {
      total += stat.median;
    }
  }
  if (basedOn.length === 0) return null;
  const inDays = Math.ceil(total);
  return { date: addDays(today, inDays), inDays, basedOn, missing, late };
}
