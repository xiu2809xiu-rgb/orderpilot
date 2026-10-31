import assert from "node:assert/strict";
import { test } from "node:test";

import { loadBacklog, loadLabels } from "./lib/catalogue.mjs";
import {
  matchIssues,
  planIssue,
  planLink,
  planPullBackfill,
  wantedItems,
  withPlannedMilestones,
} from "./seed-backlog.mjs";

const milestones = [{ number: 1, title: "Sprint 01 (W2)" }];

const wanted = {
  key: "P-1",
  title: "P-1: Ground rules",
  labels: ["type: story"],
  block: "<!-- backlog:start -->\n- [ ] text\n<!-- backlog:end -->",
  doneBlock: "<!-- backlog:start -->\n- [x] text\n<!-- backlog:end -->",
  parentKey: "Epic P",
};

const issue = (overrides = {}) => ({
  id: "I-1",
  number: 1,
  title: "P-1: Ground rules",
  body: `${wanted.block}\n`,
  state: "OPEN",
  stateReason: null,
  closedAt: null,
  milestone: null,
  labels: ["type: story"],
  parent: null,
  ...overrides,
});

test("wanted items start with the epics, so that parents exist first", () => {
  const items = wantedItems(loadBacklog(), loadLabels());
  assert.equal(items.length, 74);
  assert.equal(items[0].title, "Epic P: The platform base");
  assert.equal(items[0].parentKey, null);
  assert.ok(items.slice(0, 9).every((item) => item.key.startsWith("Epic ")));
  assert.equal(items[9].title, "P-1: Ground rules");
  assert.equal(items[9].parentKey, "Epic P");
});

test("the area label is kept whole on its stories", () => {
  const items = wantedItems(loadBacklog(), loadLabels());
  const story = items.find((item) => item.key === "D-1");
  assert.ok(story.labels.includes("area: 3 checks tracker and insights"));
});

test("issues are matched by key, with the oldest winning", () => {
  const { byKey, duplicates } = matchIssues([
    issue({ number: 9, title: "P-3: A copy" }),
    issue({ number: 5, title: "P-3: The original" }),
    issue({ number: 6, title: "A bug with no key" }),
  ]);
  assert.equal(byKey.get("P-3").number, 5);
  assert.deepEqual(duplicates, [{ key: "P-3", number: 9 }]);
  assert.equal(byKey.size, 1);
});

test("a story with no issue is created, with its labels in the JSON body", () => {
  const action = planIssue(wanted, undefined, milestones);
  assert.equal(action.type, "create");
  assert.deepEqual(action.body.labels, ["type: story"]);
  assert.ok(action.body.body.endsWith("<!-- backlog:end -->\n"));
});

test("an up-to-date issue needs nothing", () => {
  assert.equal(planIssue(wanted, issue(), milestones), null);
});

test("a hand-written open issue gains the block and keeps its words", () => {
  const action = planIssue(wanted, issue({ body: "By hand." }), milestones);
  assert.ok(action.patch.body.startsWith(wanted.block));
  assert.ok(action.patch.body.includes("By hand."));
});

test("a closed issue adopted for the first time gets its block once, ticked", () => {
  const action = planIssue(
    wanted,
    issue({
      body: "By hand.",
      state: "CLOSED",
      stateReason: "COMPLETED",
      closedAt: "2026-10-31T07:52:44Z",
      labels: [],
    }),
    milestones,
  );
  assert.deepEqual(Object.keys(action.patch).sort(), [
    "body",
    "labels",
    "milestone",
  ]);
  assert.ok(action.patch.body.startsWith(wanted.doneBlock));
  assert.ok(action.patch.body.includes("By hand."));
  assert.equal(action.patch.milestone, 1);
});

test("a closed issue that has its block never gets a new body or a state", () => {
  const changed = "<!-- backlog:start -->\n- [ ] changed\n<!-- backlog:end -->";
  const action = planIssue(
    { ...wanted, block: changed },
    issue({
      body: `${wanted.doneBlock}\n`,
      state: "CLOSED",
      stateReason: "COMPLETED",
      closedAt: "2026-10-31T07:52:44Z",
      milestone: { number: 1, title: "Sprint 01 (W2)" },
    }),
    milestones,
  );
  assert.equal(action, null);
});

test("an issue closed as not planned keeps its body", () => {
  const action = planIssue(
    wanted,
    issue({
      body: "By hand.",
      state: "CLOSED",
      stateReason: "NOT_PLANNED",
      closedAt: "2026-10-31T07:52:44Z",
    }),
    milestones,
  );
  assert.equal(action, null);
});

test("a closed story with no matching milestone yet is left for later", () => {
  const closed = issue({
    state: "CLOSED",
    stateReason: "COMPLETED",
    closedAt: "2026-10-31T07:52:44Z",
  });
  assert.equal(planIssue(wanted, closed, []), null);
});

test("a story already under its epic is not linked again", () => {
  const byKey = new Map([
    ["P-1", issue({ parent: 7 })],
    ["Epic P", issue({ number: 7, parent: null })],
  ]);
  assert.equal(planLink(wanted, byKey), null);
});

test("a story with no parent yet is linked", () => {
  const byKey = new Map([
    ["P-1", issue()],
    ["Epic P", issue({ number: 7 })],
  ]);
  const link = planLink(wanted, byKey);
  assert.equal(link.child.number, 1);
  assert.equal(link.parent.number, 7);
});

test("an epic has no parent to link to", () => {
  assert.equal(planLink({ ...wanted, parentKey: null }, new Map()), null);
});

test("a dry run plans against the milestones about to be made", () => {
  const planned = withPlannedMilestones(milestones);
  assert.equal(planned.length, 18);
  assert.equal(planned[0].number, 1);
  assert.equal(planned[1].title, "Sprint 02 (W3)");
  assert.equal(planned[1].number, null);
});

test("a merged pull request with no milestone is back-filled by merge date", () => {
  const pulls = [
    { number: 3, mergedAt: "2026-10-31T07:52:43Z", milestone: null },
    { number: 4, mergedAt: null, milestone: null },
    {
      number: 5,
      mergedAt: "2026-10-31T07:52:43Z",
      milestone: { title: "Sprint 01 (W2)" },
    },
  ];
  assert.deepEqual(planPullBackfill(pulls, milestones), [
    { number: 3, milestone: milestones[0] },
  ]);
});
