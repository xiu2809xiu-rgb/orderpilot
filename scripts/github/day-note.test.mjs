import assert from "node:assert/strict";
import { test } from "node:test";

import { addDayNote } from "./day-note.mjs";
import { GitHub } from "./lib/github.mjs";
import { SimulatedGitHub } from "./testing/simulated-github.mjs";
import { syncMilestones } from "./sync-milestones.mjs";

function client(simulated, dryRun = false) {
  return new GitHub({
    repo: "owner/name",
    exec: simulated.exec,
    sleep: async () => {},
    log: () => {},
    paceMs: 0,
    dryRun,
  });
}

async function withMilestones() {
  const simulated = new SimulatedGitHub();
  await syncMilestones(client(simulated));
  return simulated;
}

test("a note lands on the milestone of the day's sprint", async () => {
  const simulated = await withMilestones();
  await addDayNote(client(simulated), {
    text: "Merged P-2.",
    date: "2026-11-03",
  });
  assert.ok(
    simulated.milestones[1].description.endsWith("- 2026-11-03: Merged P-2."),
  );
  assert.equal(simulated.milestones[0].description.includes("Merged"), false);
});

test("the same note twice is added once", async () => {
  const simulated = await withMilestones();
  const github = client(simulated);
  const note = { text: "Merged P-2.", date: "2026-11-03" };
  assert.equal(await addDayNote(github, note), true);
  const writes = simulated.writes.length;
  assert.equal(await addDayNote(github, note), false);
  assert.equal(simulated.writes.length, writes);
});

test("a note survives the sprint calendar running again", async () => {
  const simulated = await withMilestones();
  const github = client(simulated);
  await addDayNote(github, { text: "Merged P-2.", date: "2026-11-03" });
  const writes = simulated.writes.length;
  await syncMilestones(github);
  assert.equal(simulated.writes.length, writes);
  assert.ok(simulated.milestones[1].description.includes("Merged P-2."));
});

test("a dry run adds nothing", async () => {
  const simulated = await withMilestones();
  const before = simulated.writes.length;
  await addDayNote(client(simulated, true), {
    text: "Merged P-2.",
    date: "2026-11-03",
  });
  assert.equal(simulated.writes.length, before);
});

test("a day outside the calendar is an error, so the note is not lost quietly", async () => {
  const simulated = await withMilestones();
  await assert.rejects(
    () => addDayNote(client(simulated), { text: "x", date: "2027-03-01" }),
    /outside the sprint calendar/,
  );
});

test("a missing milestone says how to make it", async () => {
  const simulated = new SimulatedGitHub();
  await assert.rejects(
    () => addDayNote(client(simulated), { text: "x", date: "2026-11-03" }),
    /Run sync-milestones\.mjs first/,
  );
});
