// The pre-push hook.
//
// 1. It refuses any push that would change main on the remote: an update, a
//    force push or a deletion, whatever refspec asked for it (`main`,
//    `HEAD:main`, `x:refs/heads/main`, `--all`, `--mirror`, `:main`). Every
//    change reaches main through a pull request (AGENTS.md rule 3), and this
//    keeps that true on every machine, whatever GitHub enforces.
// 2. It runs the samples guard on every commit being pushed.
//
// Git passes the remote's name and URL as arguments, and one line per ref on
// stdin: "<local ref> <local sha> <remote ref> <remote sha>".

import { readFileSync } from "node:fs";

import { main as checkSamples } from "../check-samples.mjs";
import { git, isZeroSha } from "../lib/git.mjs";

export const PROTECTED_REFS = new Set(["refs/heads/main"]);

/**
 * @typedef {{ localRef: string, localSha: string, remoteRef: string, remoteSha: string }} RefUpdate
 */

/**
 * @param {string} input Git's pre-push stdin.
 * @returns {RefUpdate[]}
 */
export function parseUpdates(input) {
  /** @type {RefUpdate[]} */
  const updates = [];
  for (const line of input.split(/\r?\n/)) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (localRef && localSha && remoteRef && remoteSha) {
      updates.push({ localRef, localSha, remoteRef, remoteSha });
    }
  }
  return updates;
}

/**
 * The updates that would change a protected branch on the remote.
 *
 * @param {RefUpdate[]} updates
 */
export function refusedUpdates(updates) {
  return updates.filter((update) => PROTECTED_REFS.has(update.remoteRef));
}

/**
 * What to tell the person, depending on the branch they are on.
 *
 * @param {RefUpdate[]} refused
 * @param {string} remote
 * @param {string} branch The current branch, or "" when HEAD is detached.
 */
export function refusalMessage(refused, remote, branch) {
  const lines = ["Push refused: nothing is pushed to main, by anyone.", ""];
  for (const update of refused) {
    const action = isZeroSha(update.localSha) ? "delete" : "update";
    lines.push(`  This push would ${action} ${update.remoteRef} on ${remote}.`);
  }
  lines.push(
    "",
    "Every change reaches main through a pull request (AGENTS.md, rule 3).",
    "Push your own branch instead, then open a pull request:",
    "",
  );
  if (branch === "" || branch === "main") {
    lines.push(
      "  git switch -c <type>/<short-name>   (for example docs/fix-typo)",
      `  git push -u ${remote} HEAD`,
    );
  } else {
    lines.push(`  git push -u ${remote} ${branch}`);
  }
  lines.push(
    "  gh pr create   (or open the link that Git prints)",
    "",
    "The branch names and the rest of the path are in CONTRIBUTING.md.",
  );
  return lines.join("\n");
}

/**
 * The `git log` revisions for the commits this update would add to the
 * remote: everything reachable from the new commit that the remote does not
 * already have. A new branch, or a remote commit this clone has never
 * fetched, falls back to what the remote-tracking branches hold.
 *
 * @param {RefUpdate} update
 * @param {string} remote
 * @param {boolean} remoteShaKnown Whether this clone has the remote's commit.
 * @returns {string[]}
 */
export function revisionsToCheck(update, remote, remoteShaKnown) {
  if (isZeroSha(update.remoteSha) || !remoteShaKnown) {
    return [update.localSha, "--not", `--remotes=${remote}`];
  }
  return [update.localSha, "--not", update.remoteSha];
}

/** @param {string} sha */
function hasCommit(sha) {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** @returns {string} */
function currentBranch() {
  try {
    return git(["branch", "--show-current"]).trim();
  } catch {
    return "";
  }
}

/**
 * @param {string[]} argv The remote's name and URL.
 * @param {string} input Git's pre-push stdin.
 * @returns {number} the exit code
 */
export function main(argv, input) {
  const remote = argv[0] ?? "origin";
  const updates = parseUpdates(input);

  const refused = refusedUpdates(updates);
  if (refused.length > 0) {
    console.error(refusalMessage(refused, remote, currentBranch()));
    return 1;
  }

  for (const update of updates) {
    // A deletion brings no commits, and a tag can point at a non-commit.
    if (isZeroSha(update.localSha) || !hasCommit(update.localSha)) continue;
    const known = !isZeroSha(update.remoteSha) && hasCommit(update.remoteSha);
    const revisions = revisionsToCheck(update, remote, known);
    const code = checkSamples(["--", ...revisions]);
    if (code !== 0) return code;
  }
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2), readFileSync(0, "utf8"));
}
