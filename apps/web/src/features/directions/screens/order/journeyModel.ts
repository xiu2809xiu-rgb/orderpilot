import type { Role, TimelineStep } from "@orderpilot/shared";
import {
  expectedBy,
  expectedShipDate,
  SALES_STEP_IDS,
  statOf,
  usualDuration,
  type SalesStepId,
  type ShipEstimate,
  type Usual,
} from "../../data/estimates";
import { todayInSingapore } from "@/lib/format";
import type { StepTime } from "../../data/types";
import { ALL_DONE } from "../orders/orderRow";

// An order's journey worked out from its own events and the measured step
// times. A step the data cannot time gets no number. Nothing here is a guess:
// every date is the day an event happened, or a day plus the usual days.

/**
 * The step of the nine that each of the tracker's sample events finishes. The
 * event titles are area 3's sample wording; an event not listed here simply
 * has no step, and a step with no event says only that it is done. Packing and
 * telling the customer have no event in the sample data, so they never claim
 * a person or a time.
 */
const STEP_OF_EVENT: Readonly<Record<string, number>> = {
  "Customer PO received": 1,
  "Stock checked against the order": 2,
  "Stock purchase request raised": 2,
  "Stock covered": 2,
  "Proforma invoice sent": 3,
  "Deposit confirmed": 4,
  "Prepayment confirmed": 4,
  "Payment confirmed": 4,
  "Payment received": 4,
  "Balance received": 4,
  "Packing list checked against the PO": 6,
  "Sales invoice posted in Business Central": 6,
  "Goods shipped": 7,
  "AWB recorded": 9,
};

/**
 * The team that does each of the nine steps, in the order of the sales flow:
 * Support takes the PO, makes the PI, the invoice and packing list and tells
 * the customer. The page says who holds an order from the tracker, never from
 * here: this only says who does the step that comes next.
 */
export const STEP_TEAM: Readonly<Record<SalesStepId, Role>> = {
  poIn: "SUPPORT",
  stock: "PRODUCT_MANAGER",
  pi: "SUPPORT",
  payment: "FINANCE",
  pack: "WAREHOUSE",
  documents: "SUPPORT",
  forwarder: "LOGISTICS",
  customerTold: "SUPPORT",
  awbAndPermit: "LOGISTICS",
};

export interface DoneBy {
  actor: string;
  at: Date;
}

export interface JourneyStepInfo {
  position: number;
  id: SalesStepId;
  state: "done" | "now" | "later";
  /** The team that does this step. */
  team: Role;
  /** Who finished it and when, from the order's events. */
  doneBy: DoneBy | null;
  /** The current step: when it began, and how many whole days it has waited. */
  since: Date | null;
  waitedDays: number | null;
  /** A step's usual time, or null when the data cannot say. */
  usual: Usual | null;
  /** The current step has waited longer than it usually takes. */
  late: boolean;
  /** `YYYY-MM-DD`: when a later step should be done at the usual pace. */
  expectedOn: string | null;
}

export interface Journey {
  /** 1 to 9, or 10 when every step is done. */
  current: number;
  steps: JourneyStepInfo[];
  /** The expected day the goods leave, or null when the order is past that or nothing can be timed. */
  ship: ShipEstimate | null;
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string): number =>
  Math.round(Date.parse(`${date}T00:00:00.000Z`) / DAY_MS);
const addDays = (date: string, days: number): string =>
  new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

export function buildJourney(input: {
  /** 1 to 9, 10 for finished, null when the order is not in the flow. */
  current: number | null;
  events: readonly TimelineStep[];
  stepTimes: readonly StepTime[];
  /** `YYYY-MM-DD`, in Singapore. */
  today: string;
  /**
   * When the order came to its current step, from the workflow's record. The
   * tracker's sample timeline stamps its newest event with today for every
   * order, so on its time alone an order that is days late would read "Here
   * today". `null` means the record has not answered yet, so no wait is said;
   * left out, the tracker's own time stands. A finished step whose event is
   * dated after this moment shows no person and no date, because it cannot
   * have been finished after the order came to the step it is at now: it is
   * the sample timeline's today stamp, and a second date for one act is wrong.
   * While the record has not answered (`null`) no finished step shows a person
   * or a date either, so a date is never printed and then taken back.
   */
  since?: Date | null;
}): Journey | null {
  const { current, events, stepTimes, today } = input;
  if (current === null) return null;

  const doneBy = new Map<number, DoneBy>();
  for (const event of events) {
    const position = STEP_OF_EVENT[event.title];
    if (position === undefined) continue;
    const seen = doneBy.get(position);
    const at = new Date(event.at);
    if (!seen || at.getTime() >= seen.at.getTime()) {
      doneBy.set(position, { actor: event.actor, at });
    }
  }
  // The current step began when the workflow's record says so; without that
  // record, when the order's current event happened.
  const currentEvent = events.find((event) => event.current);
  const since =
    input.since !== undefined
      ? input.since
      : currentEvent
        ? new Date(currentEvent.at)
        : null;
  // Days are counted on Singapore's calendar on both sides. `today` is the
  // Singapore date, so the moment the step began is read as a Singapore date
  // too: read as a UTC date it is a day behind for eight hours of every day,
  // and the count then says one day too many.
  const sinceDay = since ? todayInSingapore(since) : null;
  // Only a record's time can say this: the tracker's own current event is the
  // newest one, so against it every finished step would be earlier anyway.
  // While the record is on its way (null) no finished step names a person or a
  // date, so the page never prints the tracker's stamp and then takes it back.
  const finishedBy = (found: DoneBy | undefined): DoneBy | undefined => {
    if (input.since === null) return undefined;
    return found && input.since && found.at.getTime() > input.since.getTime()
      ? undefined
      : found;
  };

  const nowId = SALES_STEP_IDS[current - 1];
  const nowStat = nowId ? statOf(stepTimes, nowId) : null;
  const waitedDays = sinceDay
    ? Math.max(0, dayNumber(today) - dayNumber(sinceDay))
    : null;
  // When the current step should end at the usual pace, never before today.
  let cursor: string | null = null;
  if (nowStat && sinceDay) {
    const due = todayInSingapore(expectedBy(since ?? new Date(), nowStat).at);
    cursor = due < today ? today : due;
  }

  const steps = SALES_STEP_IDS.map((id, index): JourneyStepInfo => {
    const position = index + 1;
    const state =
      position < current ? "done" : position === current ? "now" : "later";
    const stat = statOf(stepTimes, id);
    let expectedOn: string | null = null;
    if (state === "later" && stat && cursor !== null) {
      cursor = addDays(cursor, Math.ceil(stat.median));
      expectedOn = cursor;
    }
    return {
      position,
      id,
      state,
      team: STEP_TEAM[id],
      doneBy:
        state === "done" ? (finishedBy(doneBy.get(position)) ?? null) : null,
      since: state === "now" ? since : null,
      waitedDays: state === "now" ? waitedDays : null,
      usual: state === "done" || !stat ? null : usualDuration(stat),
      late:
        state === "now" && stat !== null && waitedDays !== null
          ? waitedDays > stat.median
          : false,
      expectedOn,
    };
  });

  const ship =
    current >= ALL_DONE || !nowId || !sinceDay
      ? null
      : expectedShipDate({
          steps: stepTimes,
          currentStep: nowId,
          enteredOn: sinceDay,
          today,
        });
  return { current, steps, ship };
}

/** How many days later the expected ship day is than the order's own ship date; zero or less means on time. */
export function daysPastShipDate(
  ship: ShipEstimate | null,
  shipmentDate: string | null,
): number | null {
  if (!ship || !shipmentDate) return null;
  return dayNumber(ship.date) - dayNumber(shipmentDate.slice(0, 10));
}
