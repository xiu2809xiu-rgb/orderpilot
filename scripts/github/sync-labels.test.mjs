import assert from "node:assert/strict";
import { test } from "node:test";

import { loadLabels } from "./lib/catalogue.mjs";
import { GitHub } from "./lib/github.mjs";
import { SimulatedGitHub } from "./testing/simulated-github.mjs";
import { labelPath, planLabels, syncLabels } from "./sync-labels.mjs";

const label = (name, color = "aabbcc", description = "Words") => ({
  name,
  color,
  description,
});

test("missing labels are created and matching ones left alone", () => {
  const wanted = [label("a"), label("b")];
  const { actions } = planLabels(wanted, [label("a")]);
  assert.deepEqual(
    actions.map((action) => [action.type, action.label.name]),
    [["create", "b"]],
  );
});

test("a changed colour or description is an update", () => {
  const wanted = [label("a", "111111", "New"), label("b", "222222", "Same")];
  const existing = [label("a", "000000", "New"), label("b", "222222", "Old")];
  const { actions } = planLabels(wanted, existing);
  assert.deepEqual(
    actions.map((action) => action.type),
    ["update", "update"],
  );
});

test("colour case and a missing description compare sensibly", () => {
  const { actions } = planLabels(
    [label("a", "ABCDEF", "")],
    [{ name: "a", color: "abcdef", description: null }],
  );
  assert.deepEqual(actions, []);
});

test("a label differing only in case is renamed, not recreated", () => {
  const { actions } = planLabels([label("Type: Bug")], [label("type: bug")]);
  assert.equal(actions[0].type, "update");
  assert.equal(actions[0].from, "type: bug");
  assert.equal(actions[0].label.name, "Type: Bug");
});

test("labels outside the catalogue are reported, never deleted by default", () => {
  const { actions, extras } = planLabels(
    [label("a")],
    [label("a"), label("bug")],
  );
  assert.deepEqual(actions, []);
  assert.deepEqual(
    extras.map((item) => item.name),
    ["bug"],
  );
});

test("--prune is what deletes them", () => {
  const { actions } = planLabels([label("a")], [label("a"), label("bug")], {
    prune: true,
  });
  assert.deepEqual(
    actions.map((action) => [action.type, action.label.name]),
    [["delete", "bug"]],
  );
});

test("a label's name is encoded for the URL", () => {
  assert.equal(
    labelPath("owner/name", "area: 3 checks tracker and insights"),
    "repos/owner/name/labels/area%3A%203%20checks%20tracker%20and%20insights",
  );
});

test("a real sync keeps the area label, and the defaults", async () => {
  const simulated = new SimulatedGitHub({
    labels: [label("bug"), label("area: 3 checks tracker and insights")],
  });
  const lines = [];
  const github = new GitHub({
    repo: "owner/name",
    exec: simulated.exec,
    sleep: async () => {},
    log: (line) => lines.push(line),
    paceMs: 0,
  });
  await syncLabels(github);
  const names = simulated.labels.map((item) => item.name);
  assert.ok(names.includes("bug"));
  assert.equal(
    names.filter((name) => name === "area: 3 checks tracker and insights")
      .length,
    1,
  );
  assert.equal(simulated.labels.length, loadLabels().length + 1);
  assert.ok(lines.some((line) => line.includes("outside the catalogue: bug")));
});

test("the simulated GitHub refuses a label name with a comma, as the real one does", () => {
  const simulated = new SimulatedGitHub({ labels: [] });
  const result = simulated.exec([
    "api", "--method", "POST", "repos/owner/name/labels", "--input", "-",
  ], JSON.stringify({ name: "a, b", color: "ffffff" }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /422/);
  assert.equal(simulated.labels.length, 0);
});
