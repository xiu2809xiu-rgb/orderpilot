import type { TimelineStep } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { STEP_TIMES } from "../../data";
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

describe("daysPastShipDate", () => {
  it("compares the expected day with the order's own ship date", () => {
    const ship = journey("2026-11-12")?.ship ?? null;
    expect(daysPastShipDate(ship, "2026-11-12")).toBe(3);
    expect(daysPastShipDate(ship, "2026-11-20")).toBe(-5);
    expect(daysPastShipDate(ship, null)).toBeNull();
    expect(daysPastShipDate(null, "2026-11-12")).toBeNull();
  });
});
