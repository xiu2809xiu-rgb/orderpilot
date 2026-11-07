import { describe, expect, it } from "vitest";
import { noticesDue, scheduleOf } from "./task-schedule.js";

const CREATED = new Date("2026-11-06T00:00:00.000Z");
const SLA = {
  dueAfterMinutes: 1_440,
  remindBeforeMinutes: 240,
  escalateAfterMinutes: 1_440,
};
const schedule = scheduleOf(CREATED, SLA);
const after = (minutes: number) =>
  new Date(CREATED.getTime() + minutes * 60_000);

describe("a task's schedule", () => {
  it("works out each time from when the task was created", () => {
    expect(schedule.remindAt).toEqual(after(1_200));
    expect(schedule.dueAt).toEqual(after(1_440));
    expect(schedule.escalateAt).toEqual(after(2_880));
  });

  it.each([
    [1_199, false, false, false],
    [1_200, true, false, false],
    [1_439, true, false, false],
    [1_440, true, true, false],
    [2_879, true, true, false],
    [2_880, true, true, true],
    [9_999, true, true, true],
  ])(
    "at %i minutes: remind %s, overdue %s, escalate %s",
    (minutes, remind, overdue, escalate) => {
      expect(noticesDue(schedule, after(minutes))).toEqual({
        remind,
        overdue,
        escalate,
      });
    },
  );
});
