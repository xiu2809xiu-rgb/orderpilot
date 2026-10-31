// Small, dependency-free Git helpers for the repository checks and the hooks.
// They run before `pnpm install` has finished, and in hooks on machines where
// it never ran, so they use only Node and the git on PATH.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Git prints paths with unusual characters quoted unless this is off.
const BASE_ARGS = ["-c", "core.quotePath=false"];

/**
 * Runs git and returns its stdout. Throws with git's own message on failure.
 *
 * @param {string[]} args
 * @param {{ cwd?: string, input?: string }} [options]
 * @returns {Buffer}
 */
export function gitBuffer(args, options = {}) {
  const result = spawnSync("git", [...BASE_ARGS, ...args], {
    cwd: options.cwd,
    input: options.input,
    maxBuffer: 1024 * 1024 * 512,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = result.stderr.toString("utf8").trim();
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  }
  return result.stdout;
}

/**
 * @param {string[]} args
 * @param {{ cwd?: string, input?: string }} [options]
 * @returns {string}
 */
export function git(args, options = {}) {
  return gitBuffer(args, options).toString("utf8");
}

/**
 * Splits git's NUL-separated output (from -z) into paths.
 *
 * @param {string} output
 * @returns {string[]}
 */
export function splitNul(output) {
  return output.split("\0").filter((part) => part.length > 0);
}

/** @param {string} [cwd] */
export function repoRoot(cwd) {
  return git(["rev-parse", "--show-toplevel"], { cwd }).trim();
}

/**
 * Every file Git tracks, as repository-relative paths with forward slashes.
 *
 * @param {string} [cwd]
 */
export function trackedFiles(cwd) {
  return splitNul(git(["ls-files", "-z"], { cwd }));
}

/**
 * Files added, copied, modified or renamed in the index: what the next commit
 * would write. Deletions are left out, since they bring no content.
 *
 * @param {string} [cwd]
 */
export function stagedFiles(cwd) {
  return splitNul(
    git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], {
      cwd,
    }),
  );
}

/**
 * The staged content of a file, which may differ from the working tree.
 *
 * @param {string} path
 * @param {string} [cwd]
 */
export function readStaged(path, cwd) {
  return gitBuffer(["show", `:${path}`], { cwd });
}

/**
 * The working-tree content of a tracked file, or undefined if it was deleted.
 *
 * @param {string} root
 * @param {string} path
 */
export function readWorking(root, path) {
  try {
    return readFileSync(resolve(root, path));
  } catch {
    return undefined;
  }
}

/**
 * Git's own test for binary content: a NUL byte near the start.
 *
 * @param {Buffer} content
 */
export function isBinary(content) {
  return content.subarray(0, 8000).includes(0);
}

/**
 * The paths each commit added, changed or renamed, for the commits that
 * `git log <revisions>` lists. Merges are compared with their first parent, so
 * a file that only a merge brought in is still seen.
 *
 * @param {string[]} revisions
 * @param {string} [cwd]
 * @returns {{ commit: string, path: string }[]}
 */
export function pathsInCommits(revisions, cwd) {
  const output = git(
    [
      "log",
      "--format=%x00commit %H",
      "--name-only",
      "--diff-filter=ACMR",
      "--diff-merges=first-parent",
      "--no-renames",
      ...revisions,
      "--",
    ],
    { cwd },
  );
  /** @type {{ commit: string, path: string }[]} */
  const found = [];
  let commit = "";
  for (const line of output.split("\n")) {
    if (line.startsWith("\0commit ")) {
      commit = line.slice("\0commit ".length).trim();
    } else if (line.trim().length > 0) {
      found.push({ commit, path: line.trim() });
    }
  }
  return found;
}

/**
 * Git writes all zeros for "no commit" in pre-push input: 40 of them, or 64
 * in a SHA-256 repository.
 *
 * @param {string} sha
 */
export function isZeroSha(sha) {
  return /^0+$/.test(sha);
}
