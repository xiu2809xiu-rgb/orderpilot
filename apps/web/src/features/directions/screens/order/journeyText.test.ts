import type { TimelineStep } from "@orderpilot/shared";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { STEP_TIMES } from "../../data/index";
import { buildJourney } from "./journeyModel";
import { journeyDetails } from "./journeyText";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders"]);
});

const t = i18n.getFixedT("en", "directions-orders");

const event = (
  n: number,
  title: string,
  at: string,
  current = false,
): TimelineStep => ({
  id: `e${String(n)}`,
  at,
  actor: "Support",
  title,
  effect: "Effect",
  current,
});

// Paid on 9 Nov and waiting to be packed (step 5, usually 3 days) since the 10th.
const EVENTS = [
  event(1, "Customer PO received", "2026-11-02T08:00:00.000Z"),
  event(4, "Payment confirmed", "2026-11-09T11:00:00.000Z"),
  event(5, "Released for packing", "2026-11-10T12:00:00.000Z", true),
];

const journeyOn = (today: string) => {
  const journey = buildJourney({
    current: 5,
    events: EVENTS,
    stepTimes: STEP_TIMES.sales,
    today,
  });
  if (!journey) throw new Error("no journey");
  return journey;
};

describe("the current step on the full rail", () => {
  it("says how long the order has waited and the step's usual time, short enough for one line", () => {
    expect(journeyDetails(t, journeyOn("2026-11-12"), true)[5]).toBe(
      "Waiting 2d \u00b7 ~3d avg",
    );
  });

  it("says the same line when the step has run past its usual time: lateness is the badge's to say", () => {
    const line = journeyDetails(t, journeyOn("2026-11-16"), true)[5];
    expect(line).toBe("Waiting 6d \u00b7 ~3d avg");
    expect(line).not.toMatch(/late|past/i);
  });

  it("reads a first day and a single day as a short number of days", () => {
    expect(journeyDetails(t, journeyOn("2026-11-10"), true)[5]).toBe(
      "Waiting 0d \u00b7 ~3d avg",
    );
    expect(journeyDetails(t, journeyOn("2026-11-11"), true)[5]).toBe(
      "Waiting 1d \u00b7 ~3d avg",
    );
  });

  it("leaves out the usual time when the data has none for the step", () => {
    const journey = journeyOn("2026-11-12");
    const now = journey.steps[4];
    if (!now) throw new Error("no step");
    const untimed = {
      ...journey,
      steps: journey.steps.map((step) =>
        step === now ? { ...step, usual: null } : step,
      ),
    };
    expect(journeyDetails(t, untimed, true)[5]).toBe("Waiting 2d");
  });

  it("is a longer sentence with the date on the narrow vertical rail, as before", () => {
    expect(journeyDetails(t, journeyOn("2026-11-12"))[5]).toBe(
      "Since 10 Nov 2026, 2 days. Usually 3 days.",
    );
  });
});
