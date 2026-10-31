import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RULESET_FILE,
  checkRuleset,
  sameRuleset,
  toRulesetFile,
} from "./check-ruleset.mjs";
import { readRepoJson } from "./lib/files.mjs";
import { GitHub } from "./lib/github.mjs";
import { SimulatedGitHub } from "./testing/simulated-github.mjs";

const file = () => readRepoJson(RULESET_FILE);

const liveCopy = (overrides = {}) => ({
  id: 26237777,
  node_id: "RRS_x",
  source: "owner/name",
  source_type: "Repository",
  created_at: "2026-10-31T04:05:28.638+08:00",
  updated_at: "2026-10-31T04:05:28.685+08:00",
  current_user_can_bypass: "pull_requests_only",
  _links: { self: { href: "https://example.test" } },
  ...file(),
  ...overrides,
});

const other = {
  id: 26237858,
  name: "protect-main",
  target: "branch",
  enforcement: "active",
};

function client(rulesets, lines = []) {
  return new GitHub({
    repo: "owner/name",
    exec: new SimulatedGitHub({ rulesets }).exec,
    log: (line) => lines.push(line),
  });
}

test("the mirror holds only what the rulesets API accepts", () => {
  assert.deepEqual(Object.keys(file()).sort(), [
    "bypass_actors",
    "conditions",
    "enforcement",
    "name",
    "rules",
    "target",
  ]);
});

test("the mirror is Protect main, with the rules step 0 set", () => {
  const ruleset = file();
  assert.equal(ruleset.name, "Protect main");
  assert.equal(ruleset.enforcement, "active");
  assert.deepEqual(ruleset.conditions.ref_name.include, ["~DEFAULT_BRANCH"]);
  assert.deepEqual(
    ruleset.rules.map((rule) => rule.type),
    ["deletion", "non_fast_forward", "pull_request"],
  );
  const { parameters } = ruleset.rules[2];
  assert.equal(parameters.required_approving_review_count, 0);
  assert.equal(parameters.dismiss_stale_reviews_on_push, true);
  assert.equal(parameters.required_review_thread_resolution, true);
  assert.deepEqual(parameters.allowed_merge_methods, ["merge", "squash"]);
  assert.deepEqual(ruleset.bypass_actors, [
    { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "pull_request" },
  ]);
});

test("the extra fields of a read are dropped", () => {
  assert.deepEqual(toRulesetFile(liveCopy()), file());
});

test("key order does not count as drift", () => {
  const reordered = Object.fromEntries(Object.entries(file()).reverse());
  assert.ok(sameRuleset(reordered, file()));
});

test("a real change counts as drift", () => {
  const changed = structuredClone(file());
  changed.rules[2].parameters.required_approving_review_count = 1;
  assert.equal(sameRuleset(changed, file()), false);
});

test("the check passes, and reports the ruleset it does not mirror", async () => {
  const lines = [];
  await checkRuleset(client([liveCopy(), other], lines));
  assert.ok(lines.some((line) => line.includes('"protect-main"')));
  assert.ok(lines.some((line) => line.includes("Richie's call")));
  assert.ok(lines.some((line) => line.includes("mirrors")));
});

test("protect-main never leaks into the mirror", async () => {
  await checkRuleset(client([other, liveCopy()]));
  assert.equal(JSON.stringify(file()).includes("protect-main"), false);
});

test("drift fails the check", async () => {
  const changed = liveCopy({ enforcement: "disabled" });
  await assert.rejects(
    () => checkRuleset(client([changed])),
    /no longer mirrors/,
  );
});

test("a missing ruleset fails the check", async () => {
  await assert.rejects(() => checkRuleset(client([other])), /No ruleset/);
});
