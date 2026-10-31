import assert from "node:assert/strict";
import { test } from "node:test";

import { loadSprintGoals } from "./catalogue.mjs";
import {
  NOTES_HEADING,
  appendNote,
  milestonePatch,
  planMilestones,
  renderDescription,
  sprintNumberFromTitle,
  wantedMilestone,
} from "./milestones.mjs";
import { sprintDueOn } from "./sprint-calendar.mjs";

const goals = loadSprintGoals();
const goal = "Build the base.";

function stored(sprint, overrides = {}) {
  return {
    number: sprint,
    ...wantedMilestone(sprint, goal),
    due_on: `${sprintDueOn(sprint).slice(0, 10)}T07:00:00Z`,
    ...overrides,
  };
}

test("an empty repository gets all 18 milestones", () => {
  const actions = planMilestones(goals, []);
  assert.equal(actions.length, 18);
  assert.ok(actions.every((action) => action.type === "create"));
  assert.equal(actions[0].body.title, "Sprint 01 (W2)");
  assert.equal(actions[0].body.due_on, "2026-11-01T15:59:00Z");
  assert.equal(actions[17].body.title, "Sprint 18 (W19)");
  assert.equal(actions[17].body.due_on, "2027-02-28T15:59:00Z");
});

test("every description carries the dates and the goal", () => {
  const { description } = wantedMilestone(1, "Build the base.");
  assert.ok(description.includes("Mon 26 Oct 2026 to Sun 1 Nov 2026"));
  assert.ok(description.includes("due Sunday 23:59 Singapore time"));
  assert.ok(description.includes("module Week 2"));
  assert.ok(description.includes("**Goal:** Build the base."));
  assert.ok(description.includes(NOTES_HEADING));
  assert.ok(description.includes("day-note.mjs"));
});

test("GitHub's rewrite of the due time is not a change", () => {
  for (const time of ["00:00:00Z", "07:00:00Z", "08:00:00Z"]) {
    const dueOn = `2026-11-01T${time}`;
    assert.deepEqual(milestonePatch(1, goal, stored(1, { due_on: dueOn })), {});
  }
});

test("a due date in the wrong week is corrected", () => {
  const patch = milestonePatch(
    1,
    goal,
    stored(1, { due_on: "2026-11-15T07:00:00Z" }),
  );
  assert.deepEqual(patch, { due_on: "2026-11-01T15:59:00Z" });
});

test("a changed goal updates the description and keeps the notes", () => {
  const withNote = appendNote(
    wantedMilestone(1, "Old goal.").description,
    "2026-10-31",
    "Merged P-1.",
  );
  const patch = milestonePatch(1, "New goal.", {
    ...stored(1),
    description: withNote,
  });
  assert.ok(patch.description.includes("**Goal:** New goal."));
  assert.ok(patch.description.includes("- 2026-10-31: Merged P-1."));
  assert.equal(patch.description.includes("Old goal."), false);
});

test("a milestone with notes needs no update when nothing else changed", () => {
  const description = appendNote(
    wantedMilestone(1, goal).description,
    "2026-10-31",
    "Merged P-1.",
  );
  assert.deepEqual(milestonePatch(1, goal, stored(1, { description })), {});
});

test("hand-written lines under the notes heading survive a rewrite", () => {
  const existing = `${wantedMilestone(1, "Old.").description}\n\nA free paragraph.\n\n- 2026-10-31: A note.`;
  const next = renderDescription(1, "New.", existing);
  assert.ok(next.includes("A free paragraph."));
  assert.ok(next.includes("- 2026-10-31: A note."));
});

test("a description written before the script is kept as notes", () => {
  const next = renderDescription(1, "Goal.", "Someone wrote this.");
  assert.ok(next.includes("**Goal:** Goal."));
  assert.ok(next.endsWith("Someone wrote this."));
});

test("line endings from the web editor are not a change", () => {
  const description = wantedMilestone(1, goal).description.replace(
    /\n/g,
    "\r\n",
  );
  assert.deepEqual(milestonePatch(1, goal, stored(1, { description })), {});
});

test("a first note goes after a blank line, and later ones follow it", () => {
  const first = appendNote(
    wantedMilestone(1, goal).description,
    "2026-10-31",
    "A.",
  );
  assert.ok(first.endsWith("day-note.mjs`.\n\n- 2026-10-31: A."));
  const second = appendNote(first, "2026-11-01", "B.");
  assert.ok(second.endsWith("- 2026-10-31: A.\n- 2026-11-01: B."));
});

test("the same note on the same day is added once", () => {
  const first = appendNote(
    wantedMilestone(1, goal).description,
    "2026-10-31",
    "A.",
  );
  assert.equal(appendNote(first, "2026-10-31", "A."), null);
  assert.ok(appendNote(first, "2026-10-31", "B."));
  assert.ok(appendNote(first, "2026-11-01", "A."));
});

test("the sprint number is read from the title", () => {
  assert.equal(sprintNumberFromTitle("Sprint 01 (W2)"), 1);
  assert.equal(sprintNumberFromTitle("Sprint 18 (W19)"), 18);
  assert.equal(sprintNumberFromTitle("Something else"), null);
});

test("a retitled sprint milestone is put back, not duplicated", () => {
  const existing = [stored(1, { title: "Sprint 01" })];
  const [action] = planMilestones([{ sprint: 1, goal }], existing);
  assert.equal(action.type, "update");
  assert.deepEqual(action.patch, { title: "Sprint 01 (W2)" });
});
