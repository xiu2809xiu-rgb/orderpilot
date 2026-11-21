import { describe, expect, it } from "vitest";
import common from "@/locales/en/common.json";
import { TOUR_STEPS } from "./tourSteps";

describe("the demo tour's steps", () => {
  it("each has its title and words", () => {
    const steps = common.tour.steps as Record<
      string,
      { title?: string; body?: string } | undefined
    >;
    for (const step of TOUR_STEPS) {
      expect(steps[step.id]?.title, step.id).toBeTruthy();
      expect(steps[step.id]?.body, step.id).toBeTruthy();
    }
    expect(Object.keys(steps)).toHaveLength(TOUR_STEPS.length);
  });

  it("only undoes what a click did", () => {
    for (const step of TOUR_STEPS) {
      if (step.undo) expect(step.advance, step.id).toBe("click");
    }
  });

  it("begins and ends as the approver on Home, so the end needs no sign-in", () => {
    const first = TOUR_STEPS[0];
    const last = TOUR_STEPS.at(-1);
    expect(first?.role).toBe("APPROVER");
    expect(last?.role).toBe("APPROVER");
    expect(last?.path).toBe("/");
    // The approval waits for the end: the approver comes back after it.
    const approve = TOUR_STEPS.findIndex((step) => step.undo === "spr");
    expect(
      TOUR_STEPS.slice(approve + 1).some((step) => step.role === "APPROVER"),
    ).toBe(true);
  });
});
