// The hard requirement: a second run changes nothing and creates nothing. These
// tests run the real scripts through the real client against a simulated `gh`.

import assert from "node:assert/strict";
import { test } from "node:test";

import { loadBacklog, loadLabels } from "./lib/catalogue.mjs";
import { GitHub } from "./lib/github.mjs";
import { liveRepository } from "./testing/simulated-github.mjs";
import { seedBacklog } from "./seed-backlog.mjs";
import { syncBoard } from "./sync-board.mjs";
import { syncLabels } from "./sync-labels.mjs";
import { syncMilestones } from "./sync-milestones.mjs";

const client = (simulated, dryRun = false) =>
  new GitHub({
    repo: "xiu2809xiu-rgb/orderpilot",
    exec: simulated.exec,
    sleep: async () => {},
    log: () => {},
    paceMs: 0,
    dryRun,
  });

async function runAll(github) {
  await syncLabels(github);
  await syncMilestones(github);
  await seedBacklog(github);
  await syncBoard(github);
}

async function firstRun(overrides) {
  const simulated = liveRepository(overrides);
  await runAll(client(simulated));
  return simulated;
}

const linkedBoard = (simulated) =>
  simulated.projects.find((project) => project.number !== 2);

test("a first run builds everything", async () => {
  const simulated = await firstRun();
  const backlog = loadBacklog();
  assert.equal(simulated.milestones.length, 18);
  assert.equal(
    simulated.issues.length,
    backlog.epics.length + backlog.stories.length,
  );
  for (const label of loadLabels()) {
    assert.ok(simulated.labels.some((item) => item.name === label.name));
  }
  const board = linkedBoard(simulated);
  assert.equal(board.title, "OrderPilot delivery");
  assert.equal(board.linked, true);
  assert.deepEqual(
    board.fields.map((field) => field.name),
    ["Title", "Assignees", "Status", "Labels", "Sprint", "Estimate", "Area"],
  );
  assert.deepEqual(
    board.views.map((view) => [view.name, view.layout, view.filter]),
    [
      ["Backlog", "TABLE_LAYOUT", "-status:Done"],
      ["Sprint", "BOARD_LAYOUT", "sprint:@current"],
    ],
  );
  assert.equal(board.items.length, simulated.issues.length);
});

for (const dueTime of ["00:00:00Z", "07:00:00Z", "08:00:00Z", "15:59:00Z"]) {
  test(`a second run changes nothing when GitHub stores ${dueTime}`, async () => {
    const simulated = await firstRun({ dueTime });
    const writes = simulated.writes.length;
    assert.ok(writes > 100);
    await runAll(client(simulated));
    assert.deepEqual(simulated.writes.slice(writes), []);
  });
}

test("a dry run against the live shape writes nothing", async () => {
  const simulated = liveRepository();
  await runAll(client(simulated, true));
  assert.deepEqual(simulated.writes, []);
  assert.equal(simulated.milestones.length, 0);
  assert.equal(simulated.issues.length, 6);
});

test("a dry run before the milestones exist shows the back-fill", async () => {
  const simulated = liveRepository();
  const lines = [];
  const github = client(simulated, true);
  github.log = (line) => lines.push(line);
  await runAll(github);
  assert.ok(
    lines.includes("would update issue #1 (P-1): labels, body, milestone"),
  );
  assert.ok(lines.includes('would set pull request #3 to "Sprint 01 (W2)"'));
});

test("a dry run after a real run still finds nothing to do", async () => {
  const simulated = await firstRun();
  const lines = [];
  const github = client(simulated, true);
  github.log = (line) => lines.push(line);
  await runAll(github);
  assert.deepEqual(
    lines.filter((line) => line.startsWith("would ")),
    [],
  );
});

test("issues 1, 2 and 4 to 7 are adopted, never duplicated", async () => {
  const simulated = await firstRun();
  const keyed = (prefix) =>
    simulated.issues.filter((issue) => issue.title.startsWith(prefix));
  const adopted = {
    "P-1": 1,
    "P-2": 2,
    "P-3": 4,
    "P-4": 5,
    "P-5": 6,
    "P-6": 7,
  };
  for (const [key, number] of Object.entries(adopted)) {
    const found = keyed(`${key}:`);
    assert.deepEqual(
      found.map((issue) => issue.number),
      [number],
      key,
    );
    assert.ok(found[0].labels.includes("type: story"), key);
    assert.ok(found[0].body.includes("<!-- backlog:start -->"), key);
    assert.equal(found[0].parent, keyed("Epic P:")[0].number, key);
  }
});

test("the starter stories sit at Ready on the board, in Sprint 02", async () => {
  const simulated = await firstRun();
  const board = linkedBoard(simulated);
  const ready = ["C-2", "C-3", "C-4", "D-2", "D-3", "D-4", "F-3", "F-4", "F-5"];
  for (const key of ready) {
    const issue = simulated.issues.find((entry) =>
      entry.title.startsWith(`${key}:`),
    );
    const item = board.items.find((entry) => entry.number === issue.number);
    assert.equal(item.status, "Ready", key);
    assert.equal(item.sprint, "Sprint 02 (W3)", key);
    assert.ok(issue.labels.includes("priority: must"), key);
  }
  const status = board.fields.find((field) => field.name === "Status");
  assert.deepEqual(
    status.options.map((option) => option.name),
    ["Todo", "Ready", "In Progress", "Done"],
  );
  const atReady = board.items.filter(
    (entry) => entry.status === "Ready",
  ).length;
  assert.equal(atReady, ready.length);
});

test("a closed board is reported, and no second board is made", async () => {
  const simulated = await firstRun();
  linkedBoard(simulated).closed = true;
  const count = simulated.projects.length;
  await assert.rejects(() => syncBoard(client(simulated)), /Reopen it/);
  assert.equal(simulated.projects.length, count);
});

test("a closed story is not reopened, and is adopted once, ticked", async () => {
  const simulated = await firstRun();
  const [first] = simulated.issues;
  assert.equal(first.state, "CLOSED");
  assert.ok(first.body.startsWith("<!-- backlog:start -->"));
  assert.ok(first.body.endsWith("Written by hand.\n"));
  assert.equal(first.body.includes("- [ ] "), false);
  assert.ok(first.body.includes("- [x] "));
  assert.ok(first.labels.includes("type: story"));
  assert.ok(first.labels.includes("area: team"));
});

test("issue 1 and its pull request are back-filled into Sprint 01", async () => {
  const simulated = await firstRun();
  assert.equal(simulated.issues[0].milestone.title, "Sprint 01 (W2)");
  assert.equal(simulated.pulls[0].milestone.title, "Sprint 01 (W2)");
});

test("an open story has no milestone until it finishes", async () => {
  const simulated = await firstRun();
  assert.equal(simulated.issues[1].milestone, null);
  assert.equal(simulated.issues.at(-1).milestone, null);
});

test("closed work outside the calendar stays without a milestone", async () => {
  const simulated = liveRepository();
  simulated.issues[0].closedAt = "2026-10-20T07:00:00Z";
  await runAll(client(simulated));
  assert.equal(simulated.issues[0].milestone, null);
});

test("work closed as not planned is not back-filled", async () => {
  const simulated = liveRepository();
  simulated.issues[0].stateReason = "NOT_PLANNED";
  await runAll(client(simulated));
  assert.equal(simulated.issues[0].milestone, null);
});

test("an existing milestone on closed work is left alone", async () => {
  const simulated = await firstRun();
  const sprint5 = simulated.milestones[4];
  simulated.issues[0].milestone = {
    number: sprint5.number,
    title: sprint5.title,
  };
  const writes = simulated.writes.length;
  await seedBacklog(client(simulated));
  assert.deepEqual(simulated.writes.slice(writes), []);
  assert.equal(simulated.issues[0].milestone.number, sprint5.number);
});

test("every story is a sub-issue of its epic", async () => {
  const simulated = await firstRun();
  const backlog = loadBacklog();
  const byPrefix = (prefix) =>
    simulated.issues.find((issue) => issue.title.startsWith(prefix));
  for (const story of backlog.stories) {
    const epic = byPrefix(`Epic ${story.epic}:`);
    assert.equal(byPrefix(`${story.key}:`).parent, epic.number, story.key);
  }
});

test("a story under the wrong epic is moved", async () => {
  const simulated = await firstRun();
  const child = simulated.issues.find((issue) =>
    issue.title.startsWith("C-1:"),
  );
  const right = child.parent;
  child.parent = simulated.issues.find((issue) =>
    issue.title.startsWith("Epic T:"),
  ).number;
  await seedBacklog(client(simulated));
  assert.equal(child.parent, right);
});

test("a renamed story keeps its issue", async () => {
  const simulated = await firstRun();
  const issue = simulated.issues.find((item) => item.title.startsWith("P-3:"));
  const { number } = issue;
  const count = simulated.issues.length;
  issue.title = "P-3: Someone renamed this";
  await seedBacklog(client(simulated));
  assert.equal(simulated.issues.length, count);
  assert.equal(issue.number, number);
  assert.equal(issue.title, "P-3: The problem, the research and the questions");
});

test("ticks, notes and working labels survive a re-run", async () => {
  const simulated = await firstRun();
  const issue = simulated.issues.find((item) => item.title.startsWith("P-3:"));
  issue.body = `${issue.body.replace("- [ ] ", "- [x] ")}\nA note from a teammate.\n`;
  issue.labels.push("status: blocked");
  const writes = simulated.writes.length;
  await seedBacklog(client(simulated));
  assert.deepEqual(simulated.writes.slice(writes), []);
  assert.ok(issue.body.includes("- [x] "));
  assert.ok(issue.labels.includes("status: blocked"));
});

test("a pull request titled like a story is not taken for its issue", async () => {
  const simulated = liveRepository();
  simulated.pulls.push({
    number: 8,
    title: "P-7: something",
    state: "OPEN",
    mergedAt: null,
    milestone: null,
    closes: [],
  });
  await runAll(client(simulated));
  const issue = simulated.issues.find((item) => item.title.startsWith("P-7:"));
  assert.ok(issue.number > 8);
});

test("a second issue for a key is left alone and reported", async () => {
  const simulated = await firstRun();
  const copy = structuredClone(simulated.issues[5]);
  copy.id = "I-copy";
  copy.number = 999;
  simulated.issues.push(copy);
  const lines = [];
  const github = client(simulated);
  github.log = (line) => lines.push(line);
  const writes = simulated.writes.length;
  await seedBacklog(github);
  assert.deepEqual(simulated.writes.slice(writes), []);
  assert.ok(lines.some((line) => line.includes("#999 repeats the key")));
});

test("the seed refuses to invent labels with GitHub's default colour", async () => {
  const simulated = liveRepository();
  await assert.rejects(
    () => seedBacklog(client(simulated)),
    /Run sync-labels\.mjs first/,
  );
  assert.deepEqual(simulated.writes, []);
});

test("the abandoned project is never touched, on any run", async () => {
  const simulated = liveRepository();
  const before = structuredClone(simulated.projects[0]);
  await runAll(client(simulated));
  await runAll(client(simulated));
  assert.deepEqual(simulated.projects[0], before);
  assert.equal(linkedBoard(simulated).number > 2, true);
});

test("the abandoned project is not used even if linked here by mistake", async () => {
  const simulated = liveRepository();
  // The worst case: linked here, open again, and under the board's own title.
  Object.assign(simulated.projects[0], {
    linked: true,
    closed: false,
    title: "OrderPilot delivery",
  });
  await runAll(client(simulated));
  await runAll(client(simulated));
  assert.equal(simulated.projects.length, 2);
  assert.equal(linkedBoard(simulated).items.length, simulated.issues.length);
  assert.deepEqual(simulated.projects[0].items, []);
});

test("a later run finds the board through the repository, not by title", async () => {
  const simulated = await firstRun();
  const count = simulated.projects.length;
  await syncBoard(client(simulated));
  assert.equal(simulated.projects.length, count);
});

test("a finished sprint moving to completed changes nothing", async () => {
  const simulated = await firstRun();
  const sprint = linkedBoard(simulated).fields.find(
    (field) => field.name === "Sprint",
  );
  const { configuration } = sprint;
  configuration.completedIterations = configuration.iterations.splice(0, 2);
  const writes = simulated.writes.length;
  await syncBoard(client(simulated));
  assert.deepEqual(simulated.writes.slice(writes), []);
});

test("a person's board moves are kept", async () => {
  const simulated = await firstRun();
  const item = linkedBoard(simulated).items.find(
    (entry) => entry.number === simulated.issues[5].number,
  );
  item.status = "In Progress";
  const writes = simulated.writes.length;
  await syncBoard(client(simulated));
  assert.deepEqual(simulated.writes.slice(writes), []);
  assert.equal(item.status, "In Progress");
});

test("closed work shows as Done, in the sprint it finished", async () => {
  const simulated = await firstRun();
  const item = linkedBoard(simulated).items.find((entry) => entry.number === 1);
  assert.equal(item.status, "Done");
  assert.equal(item.sprint, "Sprint 01 (W2)");
});

test("board values come from the data", async () => {
  const simulated = await firstRun();
  const issue = simulated.issues.find((entry) =>
    entry.title.startsWith("D-1:"),
  );
  const item = linkedBoard(simulated).items.find(
    (entry) => entry.number === issue.number,
  );
  assert.equal(item.area, "3 checks tracker and insights");
  assert.equal(item.estimate, 8);
  const team = simulated.issues.find((entry) => entry.title.startsWith("T-2:"));
  const planned = linkedBoard(simulated).items.find(
    (entry) => entry.number === team.number,
  );
  assert.equal(planned.sprint, "Sprint 02 (W3)");
});
