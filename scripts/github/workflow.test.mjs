// Guards the sprint recorder's safety. It runs on `pull_request_target`, with a
// token that can write, so what it may not do matters as much as what it does.

import assert from "node:assert/strict";
import { test } from "node:test";

import { readRepoFile } from "./lib/files.mjs";

const text = readRepoFile(".github/workflows/sprint-recorder.yml");
const code = text
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");

test("every action is pinned to a full commit SHA, with its tag noted", () => {
  const uses = [...code.matchAll(/uses:\s+(\S+)(.*)$/gm)];
  assert.ok(uses.length >= 2);
  for (const [, action, comment] of uses) {
    assert.match(action, /^[\w-]+\/[\w-]+@[0-9a-f]{40}$/, action);
    assert.match(comment, /# v\d+\.\d+\.\d+$/, action);
  }
});

test("it starts with no permissions, and the job asks for the least", () => {
  assert.match(code, /^permissions: \{\}$/m);
  const job = code.slice(code.indexOf("jobs:"));
  const granted = [...job.matchAll(/^ {6}([a-z-]+): (read|write)$/gm)].map(
    ([, scope, level]) => `${scope}: ${level}`,
  );
  assert.deepEqual(granted, [
    "contents: read",
    "issues: write",
    "pull-requests: write",
  ]);
});

test("it listens only for closing", () => {
  assert.deepEqual(
    [...code.matchAll(/^ {4}types: (.+)$/gm)].map((match) => match[1]),
    ["[closed]", "[closed]"],
  );
  assert.equal(/^ {2}pull_request:/m.test(code), false);
});

test("it never touches the pull request's own code", () => {
  for (const unsafe of [
    "pull_request.head",
    "head_ref",
    "head.sha",
    "head.ref",
    "merge_commit_sha",
    "refs/pull",
  ]) {
    assert.equal(code.includes(unsafe), false, unsafe);
  }
  assert.ok(
    code.includes("ref: ${{ github.event.repository.default_branch }}"),
  );
  assert.ok(code.includes("persist-credentials: false"));
});

test("no event text is pasted into a shell", () => {
  const runs = [...code.matchAll(/^\s+run: (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(runs, ["node scripts/github/sprint-recorder.mjs"]);
});

test("a pull request closed without merging does nothing", () => {
  assert.ok(
    code.includes(
      "if: github.event_name == 'issues' || github.event.pull_request.merged == true",
    ),
  );
});

test("the recorder is given the job's own token and no other secret", () => {
  assert.ok(code.includes("GH_TOKEN: ${{ github.token }}"));
  assert.equal(code.includes("secrets."), false);
});

test("Node comes from the repository's own version file", () => {
  assert.ok(code.includes("node-version-file: .node-version"));
});
