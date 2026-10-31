import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SPRINT_COUNT,
  allSprints,
  formatDay,
  sameDueDate,
  singaporeDate,
  sprintDates,
  sprintDueOn,
  sprintForDate,
  sprintForInstant,
  sprintTitle,
} from "./sprint-calendar.mjs";

test("titles run from Sprint 01 (W2) to Sprint 18 (W19)", () => {
  assert.equal(SPRINT_COUNT, 18);
  assert.equal(sprintTitle(1), "Sprint 01 (W2)");
  assert.equal(sprintTitle(9), "Sprint 09 (W10)");
  assert.equal(sprintTitle(18), "Sprint 18 (W19)");
});

test("Sprint 1 runs from Monday 26 Oct to Sunday 1 Nov 2026", () => {
  assert.deepEqual(sprintDates(1), {
    monday: "2026-10-26",
    sunday: "2026-11-01",
  });
  assert.equal(formatDay("2026-10-26"), "Mon 26 Oct 2026");
  assert.equal(formatDay("2026-11-01"), "Sun 1 Nov 2026");
});

test("every sprint starts on a Monday and ends on a Sunday, a week apart", () => {
  for (const sprint of allSprints()) {
    const { monday, sunday } = sprintDates(sprint);
    assert.equal(new Date(`${monday}T00:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${sunday}T00:00:00Z`).getUTCDay(), 0);
  }
  assert.deepEqual(sprintDates(18), {
    monday: "2027-02-22",
    sunday: "2027-02-28",
  });
});

test("a sprint is due Sunday 23:59 in Singapore", () => {
  assert.equal(sprintDueOn(1), "2026-11-01T15:59:00Z");
  assert.equal(sprintDueOn(18), "2027-02-28T15:59:00Z");
  assert.equal(singaporeDate(sprintDueOn(1)), "2026-11-01");
});

test("the sprint turns over at Singapore midnight, not UTC midnight", () => {
  assert.equal(sprintForInstant("2026-11-01T15:59:59Z"), 1);
  assert.equal(sprintForInstant("2026-11-01T16:00:00Z"), 2);
  assert.equal(singaporeDate("2026-10-31T16:30:00Z"), "2026-11-01");
});

test("issue #1's closing time falls in Sprint 1", () => {
  assert.equal(sprintForInstant("2026-10-31T07:52:44Z"), 1);
});

test("dates outside the calendar have no sprint", () => {
  assert.equal(sprintForInstant("2026-10-25T15:59:59Z"), null);
  assert.equal(sprintForInstant("2026-10-25T16:00:00Z"), 1);
  assert.equal(sprintForDate("2027-02-28"), 18);
  assert.equal(sprintForDate("2027-03-01"), null);
  assert.equal(sprintForDate("2020-01-01"), null);
});

test("a due date matches by day, whatever time GitHub stored", () => {
  for (const stored of [
    "2026-11-01T15:59:00Z",
    "2026-11-01T00:00:00Z",
    "2026-11-01T07:00:00Z",
    "2026-11-01T08:00:00Z",
    "2026-10-31T16:00:00Z",
    "2026-10-31T13:00:00Z",
    "2026-11-02T07:00:00Z",
  ]) {
    assert.ok(sameDueDate(stored, 1), stored);
  }
});

test("a due date in another week does not match", () => {
  assert.equal(sameDueDate("2026-11-08T07:00:00Z", 1), false);
  assert.equal(sameDueDate("2026-10-25T07:00:00Z", 1), false);
  assert.equal(sameDueDate(null, 1), false);
});
