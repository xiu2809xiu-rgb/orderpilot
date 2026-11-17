import { beforeEach, describe, expect, it } from "vitest";
import { useDemoTour } from "./demoTour";

const KEY = "op.demo-tour";

beforeEach(() => {
  sessionStorage.clear();
  useDemoTour.getState().stop();
});

describe("the demo tour's place", () => {
  it("starts at the first step with nothing to undo, and keeps that for the tab", () => {
    useDemoTour.getState().start();
    expect(useDemoTour.getState().step).toBe(0);
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? "null")).toEqual({
      step: 0,
      undo: [],
    });
  });

  it("remembers what to undo, and forgets what was put back", () => {
    const tour = useDemoTour.getState();
    tour.start();
    tour.goTo(4);
    tour.remember({ kind: "task", role: "SUPPORT", taskId: "t-1" });
    tour.remember({ kind: "spr", recordNo: "SPR-1" });
    const [task] = useDemoTour.getState().undo;
    if (!task) throw new Error("nothing remembered");
    useDemoTour.getState().forget([task]);
    expect(useDemoTour.getState().undo).toEqual([
      { kind: "spr", recordNo: "SPR-1" },
    ]);
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? "null")).toEqual({
      step: 4,
      undo: [{ kind: "spr", recordNo: "SPR-1" }],
    });
  });

  it("leaves nothing behind when it stops", () => {
    useDemoTour.getState().start();
    useDemoTour.getState().stop();
    expect(useDemoTour.getState().step).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
