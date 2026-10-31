import assert from "node:assert/strict";
import { test } from "node:test";

import { areaLabels, loadLabels } from "./lib/catalogue.mjs";
import { areaOf, buildReport, closedIn, inProgress } from "./sprint-report.mjs";

const areas = areaLabels(loadLabels());

const issue = (number, overrides = {}) => ({
  number,
  title: `P-${number}: Story ${number}`,
  body: "",
  state: "OPEN",
  closedAt: null,
  labels: [],
  assignees: [],
  ...overrides,
});

const closed = (number, closedAt, overrides = {}) =>
  issue(number, { state: "CLOSED", closedAt, ...overrides });

test("the area comes from the label, comma and all", () => {
  const story = issue(1, {
    labels: ["type: story", "area: 3 checks, tracker and insights"],
  });
  assert.equal(areaOf(story, areas), "area: 3 checks, tracker and insights");
});

test("an issue form's area counts until someone adds the label", () => {
  const body =
    "### Epic\n\nEpic C\n\n### Area\n\narea: 3 checks, tracker and insights\n\n### Priority\n\npriority: must";
  assert.equal(
    areaOf(issue(1, { body }), areas),
    "area: 3 checks, tracker and insights",
  );
});

test("an issue form's Windows line endings do not lose the area", () => {
  const body = "### Area\r\n\r\narea: team\r\n\r\n### Priority";
  assert.equal(areaOf(issue(1, { body }), areas), "area: team");
});

test("an unknown area falls under no area", () => {
  assert.equal(areaOf(issue(1), areas), "no area");
  const body = "### Area\n\narea: something else";
  assert.equal(areaOf(issue(1, { body }), areas), "no area");
});

test("closed this sprint goes by Singapore dates", () => {
  const issues = [
    closed(1, "2026-10-25T15:59:59Z"),
    closed(2, "2026-10-25T16:00:00Z"),
    closed(3, "2026-11-01T15:59:59Z"),
    closed(4, "2026-11-01T16:00:00Z"),
    issue(5),
  ];
  assert.deepEqual(
    closedIn(issues, 1).map((item) => item.number),
    [2, 3],
  );
});

test("the board decides what is in progress, once it exists", () => {
  const issues = [issue(1), issue(2), issue(3, { assignees: ["someone"] })];
  const items = [
    { number: 1, status: "In Progress" },
    { number: 2, status: "Todo" },
    { number: 3, status: "Done" },
  ];
  assert.deepEqual(
    inProgress(issues, [], items).map((item) => item.number),
    [1],
  );
});

test("before the board, an open pull request or an assignee counts", () => {
  const issues = [issue(1), issue(2, { assignees: ["someone"] }), issue(3)];
  const pulls = [{ state: "OPEN", closes: [1] }];
  assert.deepEqual(
    inProgress(issues, pulls, []).map((item) => item.number),
    [1, 2],
  );
});

test("a merged pull request does not make an issue in progress", () => {
  const pulls = [{ state: "MERGED", closes: [1] }];
  assert.deepEqual(inProgress([issue(1)], pulls, []), []);
});

test("the report lists closed and in-progress work by area", () => {
  const text = buildReport({
    sprint: 1,
    goal: "Build the base.",
    areas,
    pulls: [],
    boardItems: [],
    issues: [
      closed(1, "2026-10-31T07:52:44Z", { labels: ["area: team"] }),
      closed(4, "2026-10-31T08:00:00Z", {
        labels: ["area: 3 checks, tracker and insights"],
      }),
      issue(2, { labels: ["area: team"], assignees: ["someone"] }),
      issue(3, { labels: ["area: team"] }),
    ],
  });
  assert.equal(
    text,
    [
      "Sprint 01 (W2): Mon 26 Oct 2026 to Sun 1 Nov 2026, module Week 2",
      "Goal: Build the base.",
      "",
      "Closed this sprint (2)",
      "  area: 3 checks, tracker and insights",
      "    #4 P-4: Story 4",
      "  area: team",
      "    #1 P-1: Story 1",
      "",
      "In progress (1)",
      "  area: team",
      "    #2 P-2: Story 2",
    ].join("\n"),
  );
});

test("an empty sprint says so", () => {
  const text = buildReport({
    sprint: 2,
    goal: "Goal.",
    areas,
    issues: [],
    pulls: [],
    boardItems: [],
  });
  assert.ok(text.includes("Closed this sprint (0)\n  None."));
  assert.ok(text.includes("In progress (0)\n  None."));
});
