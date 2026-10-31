import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  extraPages,
  noReplyIdentity,
  parseStatus,
  publishPages,
  wikiPages,
} from "./publish-wiki.mjs";

const identity = {
  name: "Someone",
  email: "1+someone@users.noreply.github.com",
};

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

// A bare repository holding one default Home page stands in for the wiki, so
// the real clone, commit and push all run.
function fakeWiki(t) {
  const root = mkdtempSync(join(tmpdir(), "orderpilot-wiki-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, "wiki.git");
  git(root, "init", "--quiet", "--bare", "--initial-branch=master", remote);
  const seed = join(root, "seed");
  git(root, "clone", "--quiet", remote, seed);
  writeFileSync(join(seed, "Home.md"), "Welcome to the wiki!\n");
  writeFileSync(join(seed, "Written-by-hand.md"), "A teammate wrote this.\n");
  git(seed, "add", "--all");
  git(
    seed,
    "-c",
    "user.name=GitHub",
    "-c",
    "user.email=noreply@github.com",
    "commit",
    "--quiet",
    "-m",
    "Initial Home page",
  );
  git(seed, "push", "--quiet", "origin", "HEAD");
  const pagesDir = join(root, "pages");
  mkdirSync(pagesDir);
  writeFileSync(join(pagesDir, "Home.md"), "# OrderPilot\n");
  writeFileSync(join(pagesDir, "_Sidebar.md"), "- [Home](Home)\n");
  return { root, remote, pagesDir };
}

function publish({ remote, pagesDir }, overrides = {}) {
  const lines = [];
  const result = publishPages({
    pagesDir,
    remote,
    identity,
    message: "docs: publish the wiki from abc1234",
    log: (line) => lines.push(line),
    ...overrides,
  });
  return { ...result, lines };
}

// Reads the published blob itself: a checkout would apply this machine's
// core.autocrlf and hide what really went up.
function published(remote, name) {
  const result = spawnSync("git", ["show", `HEAD:${name}`], {
    cwd: remote,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("only a GitHub no-reply address may publish", () => {
  assert.deepEqual(noReplyIdentity(identity.name, identity.email), identity);
  assert.throws(
    () => noReplyIdentity("Someone", "someone@school.example"),
    /no-reply/,
  );
  assert.throws(
    () => noReplyIdentity("Someone", "x@users.noreply.github.com.example"),
    /no-reply/,
  );
});

test("wiki pages are the Markdown files", () => {
  assert.deepEqual(wikiPages(["Home.md", "_Sidebar.md", ".git", "x.png"]), [
    "Home.md",
    "_Sidebar.md",
  ]);
});

test("pages only the wiki has are extras", () => {
  assert.deepEqual(extraPages(["Home.md", "Mine.md", ".git"], ["Home.md"]), [
    "Mine.md",
  ]);
});

test("git status lines are tidied", () => {
  assert.deepEqual(parseStatus(" M Home.md\n?? _Sidebar.md\n"), [
    "M Home.md",
    "?? _Sidebar.md",
  ]);
  assert.deepEqual(parseStatus(""), []);
});

test("publishing replaces Home, adds pages and keeps hand-written ones", (t) => {
  const wiki = fakeWiki(t);
  const { changes, extras } = publish(wiki);
  assert.equal(changes.length, 2);
  assert.deepEqual(extras, ["Written-by-hand.md"]);
  assert.equal(published(wiki.remote, "Home.md"), "# OrderPilot\n");
  assert.equal(published(wiki.remote, "_Sidebar.md"), "- [Home](Home)\n");
  assert.equal(
    published(wiki.remote, "Written-by-hand.md"),
    "A teammate wrote this.\n",
  );
});

test("the wiki's commit carries the no-reply identity", (t) => {
  const wiki = fakeWiki(t);
  publish(wiki);
  const log = git(wiki.remote, "log", "-1", "--format=%an|%ae|%cn|%ce|%s");
  assert.equal(
    log,
    `${identity.name}|${identity.email}|${identity.name}|${identity.email}|docs: publish the wiki from abc1234`,
  );
});

test("a second publish changes nothing and adds no commit", (t) => {
  const wiki = fakeWiki(t);
  publish(wiki);
  const before = git(wiki.remote, "rev-parse", "HEAD");
  const { changes } = publish(wiki);
  assert.deepEqual(changes, []);
  assert.equal(git(wiki.remote, "rev-parse", "HEAD"), before);
});

test("a dry run reports the changes and pushes nothing", (t) => {
  const wiki = fakeWiki(t);
  const before = git(wiki.remote, "rev-parse", "HEAD");
  const { changes, lines } = publish(wiki, { dryRun: true });
  assert.equal(changes.length, 2);
  assert.ok(lines.some((line) => line.startsWith("would publish")));
  assert.equal(git(wiki.remote, "rev-parse", "HEAD"), before);
});
