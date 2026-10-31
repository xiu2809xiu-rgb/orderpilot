// Holds the backlog to the brief: prompts 001 and 002 are read here, so a story
// that drifts from its title or branch fails a test rather than a review.

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadBacklog, loadLabels, loadSprintGoals } from "../lib/catalogue.mjs";
import { readRepoFile } from "../lib/files.mjs";

const backlog = loadBacklog();
const labels = loadLabels();
const brief = readRepoFile("docs/ai/prompts/001-build-the-base.md");
const prompt002 = readRepoFile(
  "docs/ai/prompts/002-finish-the-base-by-sunday.md",
);
const byKey = new Map(backlog.stories.map((story) => [story.key, story]));

// Prompt 002, section 3, item 8: three starter stories each for areas 2, 3 and 4.
const STARTERS_BY_AREA = {
  "area: 2 order workflows and approvals": ["C-2", "C-3", "C-4"],
  "area: 3 checks tracker and insights": ["D-2", "D-3", "D-4"],
  "area: 4 controls and monitoring": ["F-3", "F-4", "F-5"],
};
const STARTERS = Object.values(STARTERS_BY_AREA).flat();

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
    "P-26",
    "C-1",
    "D-1",
    "F-1",
    "F-2",
    "G-1",
    ...Array.from({ length: 9 }, (_, index) => `T-${index + 1}`),
    ...STARTERS,
    "E-5",
    "E-6",
  ];
  for (const key of expected) assert.ok(keys.includes(key), key);
  assert.equal(keys.length, expected.length + 17);
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
  // 13 from prompt 001, section 10, and E-5 and E-6 from prompt 002.
  assert.equal(own.length, 15);
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
    "A first-run guided tour for each role",
    'An "Ask OrderPilot" help panel that answers from our docs',
  ]) {
    assert.ok(titles.includes(phrase), phrase);
  }
});

test("prompt 002's starter stories: three ready Musts for each of areas 2, 3 and 4", () => {
  for (const [area, keys] of Object.entries(STARTERS_BY_AREA)) {
    for (const key of keys) {
      const story = byKey.get(key);
      assert.ok(story, key);
      assert.equal(story.area, area, key);
      assert.equal(story.priority, "must", key);
      assert.equal(story.ready, true, key);
      assert.deepEqual(story.sprints, [2], key);
      assert.ok(story.acceptance.length >= 5, key);
    }
  }
  assert.ok(
    prompt002.includes(
      "three ready-to-pull stories for each of areas 2, 3 and 4",
    ),
  );
  const ready = backlog.stories.filter((story) => story.ready);
  assert.deepEqual(
    ready.map((story) => story.key),
    STARTERS,
  );
});

test("the starter stories carry prompt 002's own words", () => {
  const text = (key) =>
    [byKey.get(key).title, ...byKey.get(key).acceptance].join(" ");
  assert.match(text("C-2"), /Azri writes the state machine himself/);
  assert.match(text("C-3"), /Approval User Setup/);
  assert.match(text("C-3"), /substitute/);
  assert.match(text("C-3"), /no self-approval/);
  assert.match(text("C-4"), /Reminders and escalations/);
  assert.match(text("D-2"), /packing-list quantity check against the PO/);
  assert.match(text("D-2"), /reported to area 2/);
  assert.match(text("D-3"), /exceptions queue flow/);
  assert.match(
    text("D-4"),
    /status, owner and overdue flags from workflow events/,
  );
  assert.match(text("F-3"), /approval limits/);
  assert.match(text("F-4"), /segregation of duties/);
  for (const field of ["Bank Account No.", "SWIFT Code", "IBAN"]) {
    assert.ok(text("F-5").includes(field), field);
  }
  assert.match(text("F-5"), /Finance and a second approver/);
});

test("E-5 and E-6 are prompt 002's two Could stories under epic E", () => {
  for (const key of ["E-5", "E-6"]) {
    assert.equal(byKey.get(key).epic, "E", key);
    assert.equal(byKey.get(key).priority, "could", key);
  }
  assert.ok(
    byKey
      .get("E-6")
      .acceptance.some((line) =>
        line.includes("labelled as AI-generated and for reference only"),
      ),
  );
});

test("the stories prompt 002 touches carry its additions", () => {
  const has = (key, pattern) =>
    assert.ok(
      byKey.get(key).acceptance.some((line) => pattern.test(line)),
      `${key}: ${pattern}`,
    );
  has("P-3", /docs\/research\/domain-notes\.md/);
  has(
    "P-3",
    /section 5\.3 of prompt 002, after the existing priority questions/,
  );
  has("P-5", /refuses any push to `main`/);
  has("P-9", /about 5 fictional customers.*3 vendors, 30 items.*10 orders/);
  has("P-7", /SPR-20261102-0001/);
  has("P-10", /session does end/);
  has("P-11", /unsaved form input is kept/);
  has(
    "P-12",
    /quick search, saved filters, column settings, and CSV and Excel export/,
  );
  has("P-12", /operation log at the foot of each detail page/);
  has("C-1", /own numbers/);
  has("C-1", /prepayment drives the payment gate/);
  has("C-1", /Configurable fields and default values/);
  has("C-1", /SPR pre-fill is a suggestion/);
  has("D-1", /payment confirmed: packing released/);
  has("F-1", /data scope/);
  has("F-1", /disabled, never deleted/);
  has("F-1", /payment type/);
  has("P-19", /business partners, each with a type and a price level/);
  has("P-19", /Opening stock and opening balances/);
  has("P-22", /landing, sign-in, the app shell and the 3D view/);
  has("T-9", /Prompt 003/);
});

test("the sprints follow prompt 002's order", () => {
  const phaseA = ["P-2", "P-3", "P-4", "P-5", "P-6", "P-7", "P-8", "P-9"];
  phaseA.push("P-10", "P-11", "P-12", "C-1", "D-1", "F-1", "F-2", "G-1");
  for (const key of phaseA) assert.deepEqual(byKey.get(key).sprints, [1], key);
  for (const key of ["P-13", "P-17", "P-21", "P-22", "P-23", "P-24"]) {
    assert.deepEqual(byKey.get(key).sprints, [2], key);
  }
  const goal = (sprint) => loadSprintGoals()[sprint - 1].goal;
  assert.match(goal(1), /Sunday 1 Nov, 23:59 Singapore time/);
  assert.match(goal(2), /Monday 2 Nov/);
  assert.match(
    goal(2),
    /P-13, P-14, P-15, P-16, P-17 to P-21, P-22 once Richie says the repository is private, P-23, P-24 and P-25/,
  );
  assert.ok(goal(2).includes("C-2 to C-4, D-2 to D-4 and F-3 to F-5"));
});

test("section 10's Could list is what the data calls could", () => {
  assert.equal(byKey.get("B-4").priority, "could");
  assert.equal(byKey.get("E-4").priority, "could");
});

test("each story's area is the owner's, as the brief assigns them", () => {
  assert.equal(byKey.get("C-1").area, "area: 2 order workflows and approvals");
  assert.equal(byKey.get("D-1").area, "area: 3 checks tracker and insights");
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
  // Rule 8 holds (prompt 002, section 7): P-22 waits for a private repository
  // and the official keys in apps/web/.env.local.
  assert.match(byKey.get("P-22").condition, /private/);
  assert.match(byKey.get("P-22").condition, /\.env\.local/);
  assert.doesNotMatch(byKey.get("P-22").condition, /keys work/);
  assert.match(byKey.get("P-24").condition, /step 8/);
  assert.match(byKey.get("T-9").condition, /base is done/);
});
