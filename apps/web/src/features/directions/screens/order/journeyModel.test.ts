import type { TimelineStep } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { STEP_TIMES } from "../../data/index";
import { buildJourney, daysPastShipDate } from "./journeyModel";

const event = (
  n: number,
  title: string,
  actor: string,
  at: string,
  current = false,
): TimelineStep => ({
  id: `e${String(n)}`,
  at,
  actor,
  title,
  effect: "Effect",
  current,
});

// An order that has been paid and now waits to be packed (step 5).
const EVENTS = [
  event(1, "Customer PO received", "System", "2026-11-02T08:00:00.000Z"),
  event(
    2,
    "Stock checked against the order",
    "Support",
    "2026-11-03T09:00:00.000Z",
  ),
  event(3, "Proforma invoice sent", "Support", "2026-11-04T10:00:00.000Z"),
  event(4, "Payment confirmed", "Finance", "2026-11-09T11:00:00.000Z"),
  event(5, "Released for packing", "System", "2026-11-10T12:00:00.000Z", true),
];

const journey = (today = "2026-11-12") =>
  buildJourney({
    current: 5,
    events: EVENTS,
    stepTimes: STEP_TIMES.sales,
    today,
  });

describe("buildJourney", () => {
  it("marks earlier steps done, the current one now and the rest later", () => {
    const steps = journey()?.steps ?? [];
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "now",
      "later",
      "later",
      "later",
      "later",
    ]);
  });

  it("says who finished a step and when, only where an event says so", () => {
    const steps = journey()?.steps ?? [];
    expect(steps[3]?.doneBy).toEqual({
      actor: "Finance",
      at: new Date("2026-11-09T11:00:00.000Z"),
    });
    // Nothing in the events finishes the first step's neighbour "stock" twice:
    // the one event is the one shown.
    expect(steps[1]?.doneBy?.actor).toBe("Support");
  });

  it("measures the wait of the current step in whole days against its usual time", () => {
    const now = journey("2026-11-12")?.steps[4];
    expect(now?.since).toEqual(new Date("2026-11-10T12:00:00.000Z"));
    expect(now?.waitedDays).toBe(2);
    expect(now?.usual).toEqual({ kind: "days", amount: 3 });
    expect(now?.late).toBe(false);
    expect(journey("2026-11-16")?.steps[4]?.late).toBe(true);
  });

  it("dates a later step by adding usual days, and leaves a step with no usual time undated", () => {
    const steps = journey("2026-11-12")?.steps ?? [];
    // Packing began on 10 Nov and usually takes 3 days: due 13 Nov.
    // Then the invoice and packing list step has no measured time in the data,
    // so it gets no date, and forwarding (2 days) comes after 13 Nov.
    expect(steps[5]?.expectedOn).toBeNull();
    expect(steps[5]?.usual).toBeNull();
    expect(steps[6]?.expectedOn).toBe("2026-11-15");
    expect(steps[7]?.expectedOn).toBeNull();
  });

  it("never dates a step before today when the current one has run over", () => {
    const steps = journey("2026-11-20")?.steps ?? [];
    expect(steps[6]?.expectedOn).toBe("2026-11-22");
  });

  it("gives the expected ship day and says which steps it could not time", () => {
    const ship = journey("2026-11-12")?.ship;
    expect(ship?.date).toBe("2026-11-15");
    expect(ship?.missing).toEqual(["documents"]);
    expect(ship?.late).toBe(false);
  });

  it("has no expected ship day once the goods have left, and no journey outside the flow", () => {
    const shipped = buildJourney({
      current: 8,
      events: EVENTS,
      stepTimes: STEP_TIMES.sales,
      today: "2026-11-12",
    });
    expect(shipped?.ship).toBeNull();
    expect(
      buildJourney({
        current: null,
        events: EVENTS,
        stepTimes: STEP_TIMES.sales,
        today: "2026-11-12",
      }),
    ).toBeNull();
  });

  it("calls every step done for a finished order", () => {
    const done = buildJourney({
      current: 10,
      events: EVENTS,
      stepTimes: STEP_TIMES.sales,
      today: "2026-11-12",
    });
    expect(done?.steps.every((step) => step.state === "done")).toBe(true);
    expect(done?.ship).toBeNull();
  });
});

// The tracker's sample timeline stamps its newest event with today, so the
// workflow's record is what says how long an order has waited at its step.
describe("when the current step began", () => {
  const withSince = (since: Date | null | undefined) =>
    buildJourney({
      current: 5,
      events: EVENTS,
      stepTimes: STEP_TIMES.sales,
      today: "2026-11-12",
      since,
    })?.steps[4];

  it("takes the workflow's time over the tracker's current event", () => {
    const now = withSince(new Date("2026-11-06T08:00:00.000Z"));
    expect(now?.since).toEqual(new Date("2026-11-06T08:00:00.000Z"));
    expect(now?.waitedDays).toBe(6);
    // Six days against a usual three: the step has run over.
    expect(now?.late).toBe(true);
  });

  it("says no wait while the workflow's record has not answered", () => {
    const now = withSince(null);
    expect(now?.since).toBeNull();
    expect(now?.waitedDays).toBeNull();
    expect(now?.late).toBe(false);
  });

  it("keeps the tracker's time when the workflow has none to give", () => {
    const now = withSince(undefined);
    expect(now?.since).toEqual(new Date("2026-11-10T12:00:00.000Z"));
    expect(now?.waitedDays).toBe(2);
  });

  it("dates the later steps from the workflow's time too", () => {
    const steps =
      buildJourney({
        current: 5,
        events: EVENTS,
        stepTimes: STEP_TIMES.sales,
        today: "2026-11-12",
        since: new Date("2026-11-06T08:00:00.000Z"),
      })?.steps ?? [];
    // Packing began on 6 Nov and usually takes 3 days: it has run over, so
    // forwarding (2 days) is counted from today, 12 Nov.
    expect(steps[6]?.expectedOn).toBe("2026-11-14");
  });
});

// SO-0049 on the demo data: the payment was confirmed on 13 Nov and the order
// came to packing on 16 Nov, yet the tracker's sample timeline dates its newest
// event (the payment's) today, 20 Nov. A finished step cannot be dated after the
// step the order is at, so the page must not print that date.
describe("a finished step dated after the current step began", () => {
  const SO_0049 = [
    event(1, "Customer PO received", "System", "2026-11-02T08:00:00.000Z"),
    event(3, "Proforma invoice sent", "Support", "2026-11-04T10:00:00.000Z"),
    event(4, "Payment received", "Finance", "2026-11-20T09:00:00.000Z", true),
  ];
  const at = (since?: Date | null) =>
    buildJourney({
      current: 5,
      events: SO_0049,
      stepTimes: STEP_TIMES.sales,
      today: "2026-11-20",
      since,
    })?.steps ?? [];

  it("shows the step as done with no person and no date", () => {
    const payment = at(new Date("2026-11-16T08:00:00.000Z"))[3];
    expect(payment?.state).toBe("done");
    expect(payment?.doneBy).toBeNull();
  });

  it("keeps the person and the date of a step finished before the current one began", () => {
    const steps = at(new Date("2026-11-16T08:00:00.000Z"));
    expect(steps[0]?.doneBy?.actor).toBe("System");
    expect(steps[2]?.doneBy?.actor).toBe("Support");
  });

  it("keeps the tracker's dates when there is no record to wait for", () => {
    expect(at(undefined)[3]?.doneBy?.actor).toBe("Finance");
  });

  // Changed from pinning the tracker's date while the record loads: that
  // printed the wrong date and then took it back.
  it("shows no person and no date for a finished step while the record has not answered", () => {
    const steps = at(null);
    expect(steps.filter((step) => step.state === "done")).toHaveLength(4);
    expect(steps.every((step) => step.doneBy === null)).toBe(true);
  });

  it("shows dates only once the record has answered, and none later than it", () => {
    const since = new Date("2026-11-16T08:00:00.000Z");
    const dated = at(since).filter((step) => step.doneBy !== null);
    expect(dated.map((step) => step.doneBy?.actor)).toEqual([
      "System",
      "Support",
    ]);
    for (const step of dated) {
      expect(step.doneBy?.at.getTime()).toBeLessThanOrEqual(since.getTime());
    }
  });
});

// `today` is Singapore's date, so the moment a step began is read on the same
// calendar. Read as a UTC date it was a day behind from midnight to 8 am in
// Singapore, and the page said one day too many for those eight hours.
describe("the calendar the wait is counted on", () => {
  const waited = (since: string, today: string) =>
    buildJourney({
      current: 5,
      events: EVENTS,
      stepTimes: STEP_TIMES.sales,
      today,
      since: new Date(since),
    })?.steps[4]?.waitedDays;

  it("reads a step that began after midnight in Singapore as that Singapore day", () => {
    // 16 Nov 18:00 UTC is 17 Nov 02:00 in Singapore: three days before 20 Nov.
    expect(waited("2026-11-16T18:00:00.000Z", "2026-11-20")).toBe(3);
  });

  it("gives the same count just before and just after Singapore's midnight for one moment", () => {
    // 6 Nov 16:07 UTC is 7 Nov 00:07 in Singapore: fourteen days before 21 Nov.
    expect(waited("2026-11-06T16:07:00.000Z", "2026-11-21")).toBe(14);
    // 6 Nov 15:53 UTC is 6 Nov 23:53 in Singapore: fourteen days before 20 Nov.
    expect(waited("2026-11-06T15:53:00.000Z", "2026-11-20")).toBe(14);
  });
});

describe("daysPastShipDate", () => {
  it("compares the expected day with the order's own ship date", () => {
    const ship = journey("2026-11-12")?.ship ?? null;
    expect(daysPastShipDate(ship, "2026-11-12")).toBe(3);
    expect(daysPastShipDate(ship, "2026-11-20")).toBe(-5);
    expect(daysPastShipDate(ship, null)).toBeNull();
    expect(daysPastShipDate(null, "2026-11-12")).toBeNull();
  });
});
