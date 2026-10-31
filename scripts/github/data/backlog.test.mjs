// Holds the backlog to the brief: Prompt 001 is read here, so a story that drifts
// from its title or branch fails a test rather than a review.

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadBacklog, loadLabels, loadSprintGoals } from "../lib/catalogue.mjs";
import { readRepoFile } from "../lib/files.mjs";

const backlog = loadBacklog();
const labels = loadLabels();
const brief = readRepoFile("docs/ai/prompts/001-build-the-base.md");
const byKey = new Map(backlog.stories.map((story) => [story.key, story]));

const POINTS = [1, 2, 3, 5, 8, 13];
const PRIORITIES = ["must", "should", "could"];
const REQS = ["M1", "M2", "M3", "M4", "M5", "M6"];

function briefHeadings() {
  const pattern = /^\*\*([A-Z]-\d+) (.+?)\*\*(?: \(`([^`]+)`\))?/gm;
  return [...brief.matchAll(pattern)].map(([, key, title, branch]) => ({
    key,
    title,
    branch,
  }));
}

test("the epics are P, A to G and T", () => {
  assert.deepEqual(
    backlog.epics.map((epic) => epic.key),
    ["P", "A", "B", "C", "D", "E", "F", "G", "T"],
  );
});

test("the epics use the capability names in the brief", () => {
  for (const epic of backlog.epics.filter((item) => /[A-G]/.test(item.key))) {
    assert.ok(
      brief.includes(`- **${epic.key}. ${epic.title}:**`),
      `Epic ${epic.key}`,
    );
  }
});

test("story keys are unique", () => {
  assert.equal(byKey.size, backlog.stories.length);
});

test("every story the brief names is here, in the expected groups", () => {
  const keys = backlog.stories.map((story) => story.key);
  const expected = [
    ...Array.from({ length: 25 }, (_, index) => `P-${index + 1}`),
    "C-1",
    "D-1",
    "F-1",
    "F-2",
    "G-1",
    ...Array.from({ length: 9 }, (_, index) => `T-${index + 1}`),
  ];
  for (const key of expected) assert.ok(keys.includes(key), key);
  assert.equal(keys.length, expected.length + 13);
});

test("titles and branches match the brief's headings", () => {
  const headings = briefHeadings();
  assert.equal(headings.length, 25 + 5);
  for (const { key, title, branch } of headings) {
    const story = byKey.get(key);
    assert.ok(story, key);
    assert.equal(story.title, title, key);
    assert.equal(story.branch, branch, key);
  }
});

test("T-1 and T-9 use the titles in the brief", () => {
  assert.ok(brief.includes(`- **T-1 ${byKey.get("T-1").title}** (now):`));
  assert.ok(
    brief.includes(
      `- **T-9 ${byKey.get("T-9").title},** when the base is done:`,
    ),
  );
});

test("T-2 to T-8 use the brief's words as titles", () => {
  for (const key of ["T-2", "T-3", "T-4", "T-5", "T-6", "T-7", "T-8"]) {
    const line = brief.match(
      new RegExp(`^- \\*\\*${key}:\\*\\* (.+)$`, "m"),
    )[1];
    const title = byKey.get(key).title.toLowerCase();
    assert.ok(line.toLowerCase().startsWith(title), key);
  }
});

test("team stories carry the sprints the brief gives them", () => {
  const expected = {
    "T-1": [1],
    "T-2": [2],
    "T-3": [2],
    "T-4": [3],
    "T-5": [4],
    "T-6": [2, 3],
    "T-7": [3, 4],
    "T-8": [5, 6],
  };
  for (const [key, sprints] of Object.entries(expected)) {
    assert.deepEqual(byKey.get(key).sprints, sprints, key);
  }
});

test("each sprint's goal names the team stories planned for it", () => {
  const goals = new Map(
    loadSprintGoals().map(({ sprint, goal }) => [sprint, goal]),
  );
  for (const story of backlog.stories.filter((item) => item.epic === "T")) {
    for (const sprint of story.sprints ?? []) {
      assert.ok(goals.get(sprint).includes(story.key), story.key);
    }
  }
});

test("the calendar's goals carry the brief's dates and tags", () => {
  const goal = (sprint) => loadSprintGoals()[sprint - 1].goal;
  assert.ok(goal(4).includes("`v0.1-proposal`"));
  assert.ok(goal(6).includes("Week 7 mock job interview"));
  for (const sprint of [7, 8, 9, 10, 11]) {
    assert.ok(goal(sprint).includes("Phase 2"), `Sprint ${sprint}`);
  }
  assert.ok(goal(12).includes("`v0.2-technical-review`"));
  assert.ok(goal(12).includes("Should list"));
  for (const sprint of [13, 14, 15]) {
    assert.ok(goal(sprint).includes("Area 4's real dashboards"));
  }
  assert.ok(goal(17).includes("`v1.0-final`"));
  assert.equal(loadSprintGoals().length, 18);
});

test("area 1's own stories sit under epics A, B and E", () => {
  const own = backlog.stories.filter((story) =>
    ["A", "B", "E"].includes(story.epic),
  );
  assert.equal(own.length, 13);
  for (const story of own) {
    assert.equal(story.area, "area: 1 document AI and integration", story.key);
  }
  const titles = own.map((story) => story.title).join(" | ");
  for (const phrase of [
    "Classification",
    "Extraction with confidence and provenance",
    "The review screen, with source highlighting",
    "The accuracy harness, with a 95% target and a comparison of models",
    "Learning from corrections, one layout at a time",
    "Layout mapping, proposed by AI and approved by a person",
    "Prompt-injection tests",
    "Email intake through a mock mailbox with signed webhooks",
    "Duplicate-PO protection",
    "A Navision-ready import file",
    "The template engine for PIs, invoices, packing lists and Excel",
    "QR codes on generated documents and carton labels",
    "Passkeys to confirm risky approvals",
  ]) {
    assert.ok(titles.includes(phrase), phrase);
  }
});

test("section 10's Could list is what the data calls could", () => {
  assert.equal(byKey.get("B-4").priority, "could");
  assert.equal(byKey.get("E-4").priority, "could");
});

test("each story's area is the owner's, as the brief assigns them", () => {
  assert.equal(byKey.get("C-1").area, "area: 2 order workflows and approvals");
  assert.equal(byKey.get("D-1").area, "area: 3 checks, tracker and insights");
  for (const key of ["F-1", "F-2", "G-1"]) {
    assert.equal(byKey.get(key).area, "area: 4 controls and monitoring", key);
  }
});

test("every story is complete, as the Definition of Ready asks", () => {
  const areas = labels
    .map((label) => label.name)
    .filter((name) => name.startsWith("area: "));
  const epics = new Set(backlog.epics.map((epic) => epic.key));
  for (const story of backlog.stories) {
    const { key } = story;
    assert.ok(epics.has(story.epic), key);
    assert.ok(story.title, key);
    assert.ok(story.summary, key);
    assert.ok(story.acceptance.length > 0, key);
    assert.ok(areas.includes(story.area), key);
    assert.ok(PRIORITIES.includes(story.priority), key);
    assert.ok(POINTS.includes(story.estimate), key);
    assert.ok(story.reqs.length > 0, key);
    assert.ok(
      story.reqs.every((req) => REQS.includes(req)),
      key,
    );
  }
});

test("every requirement is covered by at least one story", () => {
  const covered = new Set(backlog.stories.flatMap((story) => story.reqs));
  assert.deepEqual([...covered].sort(), REQS);
});

test("every acceptance criterion is one line that can stand alone", () => {
  for (const story of backlog.stories) {
    for (const line of story.acceptance) {
      assert.equal(line.includes("\n"), false, story.key);
      assert.match(line, /[.!?)`]$/, `${story.key}: ${line}`);
    }
  }
});

test("dependencies exist and do not loop", () => {
  const visit = (key, trail) => {
    assert.equal(trail.includes(key), false, [...trail, key].join(" > "));
    for (const next of byKey.get(key).dependsOn) {
      assert.ok(byKey.has(next), `${key} depends on ${next}`);
      visit(next, [...trail, key]);
    }
  };
  for (const key of byKey.keys()) visit(key, []);
});

test("planned sprints are inside the calendar", () => {
  for (const story of backlog.stories) {
    for (const sprint of story.sprints ?? []) {
      assert.ok(sprint >= 1 && sprint <= 18, story.key);
    }
  }
});

test("conditional stories state their condition", () => {
  assert.match(byKey.get("P-22").condition, /private/);
  assert.match(byKey.get("P-24").condition, /step 8/);
  assert.match(byKey.get("T-9").condition, /base is done/);
});
