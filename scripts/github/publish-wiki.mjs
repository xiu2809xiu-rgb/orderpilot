// Publishes `docs/wiki/` to the repository's wiki.
// Usage: node scripts/github/publish-wiki.mjs [--dry-run]
//
// Pages in the wiki that `docs/wiki/` does not have are reported and left there:
// someone may have written them by hand.

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { REPO_ROOT, repoPath } from "./lib/files.mjs";
import { DEFAULT_REPO } from "./lib/github.mjs";

const WIKI_FOLDER = "docs/wiki";
const NO_REPLY = /@users\.noreply\.github\.com$/;

export function runGit(args, { cwd = REPO_ROOT } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

// The wiki's history is public, so a commit must never carry a school or
// personal address.
export function noReplyIdentity(name, email) {
  if (!NO_REPLY.test(email)) {
    throw new Error(
      `git user.email must be a GitHub no-reply address to publish, not "${email}".`,
    );
  }
  return { name, email };
}

export function wikiPages(names) {
  return names.filter((name) => name.endsWith(".md")).sort();
}

export function extraPages(wikiFiles, localPages) {
  const local = new Set(localPages);
  return wikiPages(wikiFiles).filter((name) => !local.has(name));
}

export function parseStatus(porcelain) {
  return porcelain
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim());
}

function cloneWiki(remote, folder) {
  // Set for this clone alone, so that it works whichever credential helper a
  // machine has, and so Windows does not rewrite line endings under `git add`.
  runGit([
    "clone",
    "--quiet",
    "-c",
    "core.autocrlf=false",
    "-c",
    "credential.helper=",
    "-c",
    "credential.helper=!gh auth git-credential",
    remote,
    folder,
  ]);
}

function commitAndPush(folder, identity, message) {
  runGit(["add", "--all"], { cwd: folder });
  runGit(
    [
      "-c",
      `user.name=${identity.name}`,
      "-c",
      `user.email=${identity.email}`,
      "commit",
      "--quiet",
      "-m",
      message,
    ],
    { cwd: folder },
  );
  runGit(["push", "--quiet", "origin", "HEAD"], { cwd: folder });
}

export function publishPages({
  pagesDir,
  remote,
  identity,
  message,
  dryRun = false,
  log = console.log,
}) {
  const pages = wikiPages(readdirSync(pagesDir));
  const folder = mkdtempSync(join(tmpdir(), "orderpilot-wiki-"));
  try {
    cloneWiki(remote, folder);
    const extras = extraPages(readdirSync(folder), pages);
    for (const name of pages) {
      copyFileSync(join(pagesDir, name), join(folder, name));
    }
    const changes = parseStatus(
      runGit(["status", "--porcelain"], { cwd: folder }),
    );
    for (const line of changes) {
      log(`${dryRun ? "would publish" : "publishing"}: ${line}`);
    }
    if (extras.length > 0) log(`wiki pages left alone: ${extras.join(", ")}`);
    if (changes.length > 0 && !dryRun) {
      commitAndPush(folder, identity, message);
    }
    log(`wiki: ${changes.length} page(s) to publish`);
    return { changes, extras };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

export async function publishWiki({
  dryRun = false,
  repo = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO,
  log = console.log,
} = {}) {
  if (!dryRun) {
    const dirty = runGit(["status", "--porcelain", "--", WIKI_FOLDER]);
    if (dirty)
      throw new Error(`Commit ${WIKI_FOLDER} first:
${dirty}`);
  }
  return publishPages({
    pagesDir: repoPath(WIKI_FOLDER),
    remote: `https://github.com/${repo}.wiki.git`,
    identity: noReplyIdentity(
      runGit(["config", "user.name"]),
      runGit(["config", "user.email"]),
    ),
    message: `docs: publish the wiki from ${runGit(["rev-parse", "--short", "HEAD"])}`,
    dryRun,
    log,
  });
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli();
    await publishWiki({ dryRun: values["dry-run"] });
  });
}
