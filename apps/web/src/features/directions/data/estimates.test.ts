import { describe, expect, it } from "vitest";
import {
  SALES_STEP_IDS,
  expectedBy,
  expectedShipDate,
  statOf,
  usualDuration,
} from "./estimates.ts";
import { STEP_TIMES } from "./index";
import type { StepTime } from "./types";

const step = (
  id: string,
  median: number | null,
  unit: "days" | "hours" = "days",
): StepTime => ({
  id,
  position: 1,
  measured: median !== null,
  from: null,
  to: null,
  unit: median === null ? null : unit,
  n: median === null ? 0 : 40,
  p25: median === null ? null : median - 1,
  median,
  p75: median === null ? null : median + 1,
  note: "",
});

/** Every step 2 days, except the documents step, which the data cannot time. */
const steps = SALES_STEP_IDS.map((id) =>
  step(id, id === "documents" ? null : 2),
);

describe("statOf", () => {
  it("answers null for a step that is left out or unknown", () => {
    expect(statOf(steps, "documents")).toBeNull();
    expect(statOf(steps, "nope")).toBeNull();
  });

  it("answers the measured figures", () => {
    expect(statOf(steps, "pi")).toEqual({
      unit: "days",
      n: 40,
      p25: 1,
      median: 2,
      p75: 3,
    });
  });
});

describe("usualDuration", () => {
  const stat = (median: number, unit: "days" | "hours") => ({
    unit,
    n: 20,
    p25: 0,
    median,
    p75: 9,
  });

  it("speaks in hours under two days", () => {
    expect(usualDuration(stat(5, "hours"))).toEqual({
      kind: "hours",
      amount: 5,
    });
    expect(usualDuration(stat(47, "hours"))).toEqual({
      kind: "hours",
      amount: 47,
    });
  });

  it("moves a long span of hours to days", () => {
    expect(usualDuration(stat(72, "hours"))).toEqual({
      kind: "days",
      amount: 3,
    });
  });

  it("calls under an hour, or under a day in days, the same day", () => {
    expect(usualDuration(stat(0.2, "hours"))).toEqual({ kind: "sameDay" });
    expect(usualDuration(stat(0, "days"))).toEqual({ kind: "sameDay" });
  });

  it("speaks in days for days", () => {
    expect(usualDuration(stat(4, "days"))).toEqual({ kind: "days", amount: 4 });
  });
});

describe("expectedBy", () => {
  const since = new Date("2026-11-13T09:00:00.000Z");

  it("gives a time of day for a step measured in hours", () => {
    const { at, precision } = expectedBy(since, {
      unit: "hours",
      n: 9,
      p25: 1,
      median: 7.5,
      p75: 9,
    });
    expect(precision).toBe("time");
    expect(at.toISOString()).toBe("2026-11-13T16:30:00.000Z");
  });

  it("gives only a day for a step measured in days", () => {
    const { at, precision } = expectedBy(since, {
      unit: "days",
      n: 9,
      p25: 1,
      median: 1.5,
      p75: 3,
    });
    expect(precision).toBe("day");
    expect(at.toISOString()).toBe("2026-11-15T09:00:00.000Z");
  });
});

describe("expectedShipDate", () => {
  it("adds the usual time of each step from here to shipping, skipping what cannot be timed", () => {
    // pack (2), documents (cannot be timed) and forwarder (2), none waited yet.
    const estimate = expectedShipDate({
      steps,
      currentStep: "pack",
      enteredOn: "2026-11-13",
      today: "2026-11-13",
    });
    expect(estimate).toMatchObject({
      date: "2026-11-17",
      inDays: 4,
      basedOn: ["pack", "forwarder"],
      missing: ["documents"],
      late: false,
    });
  });

  it("takes off the days the order has already waited at its step", () => {
    const estimate = expectedShipDate({
      steps,
      currentStep: "pack",
      enteredOn: "2026-11-12",
      today: "2026-11-13",
    });
    expect(estimate?.inDays).toBe(3);
  });

  it("marks a step that has run past its usual time, and adds nothing for it", () => {
    const estimate = expectedShipDate({
      steps,
      currentStep: "pack",
      enteredOn: "2026-11-05",
      today: "2026-11-13",
    });
    expect(estimate).toMatchObject({ late: true, inDays: 2 });
  });

  it("answers the ship step alone for an order that is packed", () => {
    const estimate = expectedShipDate({
      steps,
      currentStep: "forwarder",
      enteredOn: "2026-11-13",
      today: "2026-11-13",
    });
    expect(estimate).toMatchObject({
      date: "2026-11-15",
      basedOn: ["forwarder"],
      missing: [],
    });
  });

  it("answers null for an order past shipping, or at an unknown step", () => {
    const input = { steps, enteredOn: "2026-11-13", today: "2026-11-13" };
    expect(
      expectedShipDate({ ...input, currentStep: "customerTold" }),
    ).toBeNull();
    expect(
      expectedShipDate({ ...input, currentStep: "awbAndPermit" }),
    ).toBeNull();
    expect(expectedShipDate({ ...input, currentStep: "elsewhere" })).toBeNull();
  });

  it("answers null when no step on the way can be timed", () => {
    const none = SALES_STEP_IDS.map((id) => step(id, null));
    expect(
      expectedShipDate({
        steps: none,
        currentStep: "pi",
        enteredOn: "2026-11-13",
        today: "2026-11-13",
      }),
    ).toBeNull();
  });

  it("works on the committed step times", () => {
    const estimate = expectedShipDate({
      steps: STEP_TIMES.sales,
      currentStep: "payment",
      enteredOn: STEP_TIMES.source.referenceDate,
      today: STEP_TIMES.source.referenceDate,
    });
    // payment 4, pack 3 and forwarder 2: the medians in step-times.json.
    expect(estimate?.inDays).toBe(9);
    expect(estimate?.missing).toEqual(["documents"]);
  });
});
