import assert from "node:assert/strict";
import { test } from "node:test";

import {
  planFromIssue,
  planFromPull,
  record,
  targetFromEvent,
  updatesFor,
} from "./sprint-recorder.mjs";

const milestones = [
  { number: 11, title: "Sprint 01 (W2)" },
  { number: 12, title: "Sprint 02 (W3)" },
];

const closedByHand = (overrides = {}) => ({
  number: 8,
  state: "CLOSED",
  stateReason: "COMPLETED",
  closedAt: "2026-10-31T07:52:44Z",
  milestone: null,
  timelineItems: { nodes: [{ closer: null }] },
  ...overrides,
});

const closedByPull = (overrides = {}) =>
  closedByHand({
    timelineItems: {
      nodes: [
        {
          closer: {
            __typename: "PullRequest",
            number: 3,
            mergedAt: "2026-10-31T07:52:43Z",
            milestone: null,
          },
        },
      ],
    },
    ...overrides,
  });

const merged = (overrides = {}) => ({
  number: 3,
  merged: true,
  mergedAt: "2026-10-31T07:52:43Z",
  milestone: null,
  closingIssuesReferences: {
    nodes: [
      { number: 1, state: "CLOSED", stateReason: "COMPLETED", milestone: null },
    ],
  },
  ...overrides,
});

function stub({ issue, pullRequest, list = milestones, write, current }) {
  const writes = [];
  const lines = [];
  return {
    writes,
    lines,
    github: {
      repo: "owner/name",
      owner: "owner",
      name: "name",
      log: (line) => lines.push(line),
      query: async () => ({ repository: { issue, pullRequest } }),
      getAll: async () => list,
      get: async () => ({ milestone: current ?? null }),
      write:
        write ??
        (async (summary, method, path, body) => {
          writes.push({ method, path, body });
        }),
    },
  };
}

test("an issue closing is a target", () => {
  const target = targetFromEvent("issues", {
    action: "closed",
    issue: { number: 8 },
  });
  assert.deepEqual(target, { kind: "issue", number: 8 });
});

test("a merged pull request is a target", () => {
  const target = targetFromEvent("pull_request_target", {
    action: "closed",
    pull_request: { number: 3, merged: true },
  });
  assert.deepEqual(target, { kind: "pull", number: 3 });
});

test("a pull request closed without merging is not", () => {
  const target = targetFromEvent("pull_request_target", {
    action: "closed",
    pull_request: { number: 3, merged: false },
  });
  assert.equal(target, null);
});

test("other events are not targets", () => {
  assert.equal(targetFromEvent("issues", { action: "opened" }), null);
  assert.equal(targetFromEvent("push", { action: "closed" }), null);
});

test("an issue closed by hand gets the sprint of the day it closed", () => {
  const plan = planFromIssue(closedByHand());
  assert.equal(plan.when, "2026-10-31T07:52:44Z");
  assert.deepEqual(plan.items, [{ kind: "issue", number: 8, current: null }]);
});

test("an issue closed by a merge goes by the merge, with its pull request", () => {
  const plan = planFromIssue(closedByPull());
  assert.equal(plan.when, "2026-10-31T07:52:43Z");
  assert.deepEqual(plan.items, [
    { kind: "issue", number: 8, current: null },
    { kind: "pull request", number: 3, current: null },
  ]);
});

test("a merge at Sunday 23:59:59 stays in that sprint if the issue closes on Monday", async () => {
  const issue = closedByPull({ closedAt: "2026-11-01T16:00:01Z" });
  issue.timelineItems.nodes[0].closer.mergedAt = "2026-11-01T15:59:59Z";
  const { updates, milestone } = updatesFor(planFromIssue(issue), milestones);
  assert.equal(milestone.title, "Sprint 01 (W2)");
  assert.equal(updates.length, 2);
});

test("a closed-event closer that is a commit counts as closed by hand", () => {
  const plan = planFromIssue(
    closedByHand({
      timelineItems: { nodes: [{ closer: { __typename: "Commit" } }] },
    }),
  );
  assert.equal(plan.items.length, 1);
});

test("an issue closed as not planned or a duplicate is not recorded", () => {
  assert.equal(
    planFromIssue(closedByHand({ stateReason: "NOT_PLANNED" })),
    null,
  );
  assert.equal(planFromIssue(closedByHand({ stateReason: "DUPLICATE" })), null);
});

test("an issue reopened before the run is not recorded", () => {
  assert.equal(planFromIssue(closedByHand({ state: "OPEN" })), null);
});

test("a merged pull request takes its closing issues with it", () => {
  const plan = planFromPull(merged());
  assert.equal(plan.when, "2026-10-31T07:52:43Z");
  assert.deepEqual(plan.items, [
    { kind: "pull request", number: 3, current: null },
    { kind: "issue", number: 1, current: null },
  ]);
});

test("an issue GitHub has not closed yet still goes with its merge", () => {
  const plan = planFromPull(
    merged({
      closingIssuesReferences: {
        nodes: [
          { number: 1, state: "OPEN", stateReason: null, milestone: null },
        ],
      },
    }),
  );
  assert.equal(plan.items.length, 2);
});

test("a closing issue closed as not planned stays out", () => {
  const plan = planFromPull(
    merged({
      closingIssuesReferences: {
        nodes: [
          {
            number: 1,
            state: "CLOSED",
            stateReason: "NOT_PLANNED",
            milestone: null,
          },
        ],
      },
    }),
  );
  assert.equal(plan.items.length, 1);
});

test("a pull request that did not merge is not recorded", () => {
  assert.equal(planFromPull(merged({ merged: false })), null);
});

test("an item already in the right milestone is skipped", () => {
  const { updates } = updatesFor(
    {
      when: "2026-10-31T07:52:43Z",
      items: [
        { kind: "issue", number: 1, current: 11 },
        { kind: "pull request", number: 3, current: null },
      ],
    },
    milestones,
  );
  assert.deepEqual(
    updates.map((item) => item.number),
    [3],
  );
});

test("an item in another sprint's milestone moves to the week it finished", () => {
  const { updates, milestone } = updatesFor(
    {
      when: "2026-11-04T07:00:00Z",
      items: [{ kind: "issue", number: 1, current: 11 }],
    },
    milestones,
  );
  assert.equal(milestone.number, 12);
  assert.equal(updates.length, 1);
});

test("recording an issue closed by hand sets its milestone", async () => {
  const { github, writes } = stub({ issue: closedByHand() });
  await record(github, { kind: "issue", number: 8 });
  assert.deepEqual(writes, [
    {
      method: "PATCH",
      path: "repos/owner/name/issues/8",
      body: { milestone: 11 },
    },
  ]);
});

test("recording a merge sets both the pull request and its issue", async () => {
  const { github, writes } = stub({ pullRequest: merged() });
  await record(github, { kind: "pull", number: 3 });
  assert.deepEqual(
    writes.map((write) => write.path),
    ["repos/owner/name/issues/3", "repos/owner/name/issues/1"],
  );
});

test("both events for one merge end in the same place", async () => {
  const fromIssue = stub({ issue: closedByPull() });
  const fromPull = stub({ pullRequest: merged() });
  await record(fromIssue.github, { kind: "issue", number: 8 });
  await record(fromPull.github, { kind: "pull", number: 3 });
  assert.deepEqual(fromIssue.writes[0].body, fromPull.writes[0].body);
});

test("a date outside the calendar is a no-op, not a failure", async () => {
  const { github, writes, lines } = stub({
    issue: closedByHand({ closedAt: "2027-03-01T07:00:00Z" }),
  });
  await record(github, { kind: "issue", number: 8 });
  assert.deepEqual(writes, []);
  assert.ok(lines.some((line) => line.includes("Nothing to record")));
});

test("a date before Sprint 1 is a no-op too", async () => {
  const { github, writes } = stub({
    issue: closedByHand({ closedAt: "2026-10-25T15:59:59Z" }),
  });
  await record(github, { kind: "issue", number: 8 });
  assert.deepEqual(writes, []);
});

test("a milestone that does not exist yet is a no-op, not a failure", async () => {
  const { github, writes } = stub({ issue: closedByHand(), list: [] });
  await record(github, { kind: "issue", number: 8 });
  assert.deepEqual(writes, []);
});

test("work that was not finished is a no-op", async () => {
  const { github, writes } = stub({
    issue: closedByHand({ stateReason: "NOT_PLANNED" }),
  });
  await record(github, { kind: "issue", number: 8 });
  assert.deepEqual(writes, []);
});

test("a failed write is harmless when the twin run already set the milestone", async () => {
  const { github, lines } = stub({
    issue: closedByHand(),
    current: { number: 11 },
    write: async () => {
      throw new Error("gh failed: unexpected end of JSON input");
    },
  });
  await record(github, { kind: "issue", number: 8 });
  assert.ok(lines.some((line) => line.includes("already has")));
});

test("a failed write still fails the run when the milestone is not set", async () => {
  const { github } = stub({
    issue: closedByHand(),
    current: null,
    write: async () => {
      throw new Error("gh failed: unexpected end of JSON input");
    },
  });
  await assert.rejects(
    () => record(github, { kind: "issue", number: 8 }),
    /unexpected end of JSON input/,
  );
});
