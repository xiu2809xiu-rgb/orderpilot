// The pre-push guard, tested two ways: its pure functions, and real pushes
// from a throwaway clone to a throwaway bare repository with this
// repository's .githooks installed.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { TempRepo } from "../lib/temp-repo.mjs";
import {
  parseUpdates,
  refusalMessage,
  refusedUpdates,
  revisionsToCheck,
} from "./pre-push.mjs";

const HOOKS = join(import.meta.dirname, "..", "..", ".githooks");
const ZERO = "0".repeat(40);
const A = "a".repeat(40);
const B = "b".repeat(40);

describe("pre-push: refusing main", () => {
  it("parses Git's stdin lines", () => {
    const updates = parseUpdates(
      `refs/heads/x ${A} refs/heads/main ${B}\r\n\nrefs/tags/v1 ${A} refs/tags/v1 ${ZERO}\n`,
    );
    assert.equal(updates.length, 2);
    assert.deepEqual(updates[0], {
      localRef: "refs/heads/x",
      localSha: A,
      remoteRef: "refs/heads/main",
      remoteSha: B,
    });
  });

  it("refuses an update, a creation and a deletion of main", () => {
    const refused = refusedUpdates(
      parseUpdates(
        [
          `refs/heads/main ${A} refs/heads/main ${B}`,
          `refs/heads/x ${A} refs/heads/main ${ZERO}`,
          `(delete) ${ZERO} refs/heads/main ${B}`,
          `refs/heads/feat/a ${A} refs/heads/feat/a ${B}`,
          `refs/heads/main ${A} refs/heads/mainline ${B}`,
          `refs/tags/main ${A} refs/tags/main ${ZERO}`,
        ].join("\n"),
      ),
    );
    assert.equal(refused.length, 3);
  });

  it("says how to push a branch instead", () => {
    const refused = parseUpdates(`refs/heads/main ${A} refs/heads/main ${B}`);
    const onBranch = refusalMessage(refused, "origin", "docs/fix-typo");
    assert.match(onBranch, /git push -u origin docs\/fix-typo/);
    assert.match(onBranch, /pull request/);
    const onMain = refusalMessage(refused, "origin", "main");
    assert.match(onMain, /git switch -c/);
    const deletion = parseUpdates(`(delete) ${ZERO} refs/heads/main ${B}`);
    assert.match(refusalMessage(deletion, "origin", "x"), /would delete/);
  });

  it("checks only the commits the remote lacks", () => {
    const update = parseUpdates(`refs/heads/x ${A} refs/heads/x ${B}`)[0];
    assert.ok(update);
    assert.deepEqual(revisionsToCheck(update, "origin", true), [A, "--not", B]);
    assert.deepEqual(revisionsToCheck(update, "origin", false), [
      A,
      "--not",
      "--remotes=origin",
    ]);
  });
});

describe("pre-push: real pushes to a bare repository", () => {
  /** @type {TempRepo} */
  let remote;
  /** @type {TempRepo} */
  let work;
  /** @type {string} */
  let mainOnRemote;

  before(() => {
    remote = new TempRepo({ bare: true });
    work = new TempRepo();
    work.git(["remote", "add", "origin", remote.dir]);
    work.commit({ "README.md": "# Test\n" }, "docs: start");
    // Seed main the way GitHub would hold it, without the hooks.
    work.git(["push", "-q", "--no-verify", "origin", "main"]);
    mainOnRemote = remote.git(["rev-parse", "main"]).trim();
    work.git(["config", "core.hooksPath", HOOKS]);
    work.git(["switch", "-q", "-c", "feat/area1-thing"]);
    work.commit({ "notes.md": "work\n" }, "feat: add notes");
  });

  after(() => {
    work.remove();
    remote.remove();
  });

  /** @param {string[]} args */
  const push = (args) => work.tryGit(["push", ...args]);

  /** @param {string[]} args */
  function assertRefused(args) {
    const result = push(args);
    assert.notEqual(result.status, 0, `git push ${args.join(" ")} succeeded`);
    assert.match(result.stderr, /Push refused/, result.stderr);
    assert.equal(remote.git(["rev-parse", "main"]).trim(), mainOnRemote);
  }

  it("lets a branch through", () => {
    const result = push(["-u", "origin", "feat/area1-thing"]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("lets --all through while main is unchanged", () => {
    work.git(["branch", "docs/other"]);
    const result = push(["--all", "origin"]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("refuses HEAD:main and x:refs/heads/main from a branch", () => {
    assertRefused(["origin", "HEAD:main"]);
    assertRefused(["origin", "feat/area1-thing:refs/heads/main"]);
    assertRefused(["--force", "origin", "HEAD:main"]);
  });

  it("refuses main, --all and --mirror once main has new commits", () => {
    work.git(["switch", "-q", "main"]);
    work.commit({ "direct.md": "oops\n" }, "docs: commit on main");
    assertRefused(["origin", "main"]);
    assertRefused(["origin", "HEAD"]);
    assertRefused(["--all", "origin"]);
    assertRefused(["--mirror", "origin"]);
    work.git(["switch", "-q", "feat/area1-thing"]);
  });

  it("refuses deleting main", () => {
    assertRefused(["origin", ":main"]);
    assertRefused(["origin", "--delete", "main"]);
  });

  it("lets a tag through", () => {
    work.git(["tag", "v0.0.1-test"]);
    const result = push(["origin", "v0.0.1-test"]);
    assert.equal(result.status, 0, result.stderr);
  });

  it("refuses a branch whose commits hold a client sample", () => {
    work.git(["switch", "-q", "-c", "fix/sample-slip"]);
    work.commit({ "samples/po-001.pdf": "%PDF-1.7" }, "fix: slip");
    const result = push(["origin", "fix/sample-slip"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /check-samples/);
    assert.equal(
      remote.tryGit(["rev-parse", "--verify", "-q", "fix/sample-slip"]).status,
      1,
    );
  });
});
