// Refuses the em dash (U+2014) in every text file and commit message, a rule
// from CLAUDE.md section 9. The character is written as an escape here so that
// this file passes its own check.
//
// Usage:
//   node scripts/check-dashes.mjs              every tracked text file
//   node scripts/check-dashes.mjs --staged     what the next commit would write
//   node scripts/check-dashes.mjs --message=F  a commit message file
//   node scripts/check-dashes.mjs a.md b.md    the named files

import {
  isBinary,
  readStaged,
  readWorking,
  repoRoot,
  stagedFiles,
  trackedFiles,
} from "./lib/git.mjs";
import { parseArgs, report } from "./lib/report.mjs";

export const EM_DASH = "\u2014";

const ADVICE =
  "Replace each em dash with a hyphen, a colon or a new sentence (CLAUDE.md section 9).";

/**
 * Every em dash in the text, with 1-based line and column numbers.
 *
 * @param {string} text
 * @param {{ skipComments?: boolean }} [options] skipComments ignores lines
 *   that start with "#", which Git strips from a commit message.
 * @returns {{ line: number, column: number }[]}
 */
export function findDashes(text, options = {}) {
  /** @type {{ line: number, column: number }[]} */
  const found = [];
  const lines = text.split("\n");
  lines.forEach((content, index) => {
    if (options.skipComments && content.startsWith("#")) return;
    let column = content.indexOf(EM_DASH);
    while (column !== -1) {
      found.push({ line: index + 1, column: column + 1 });
      column = content.indexOf(EM_DASH, column + 1);
    }
  });
  return found;
}

/**
 * @param {string} name How the file is named in the report.
 * @param {Buffer | undefined} content
 * @param {{ skipComments?: boolean }} [options]
 * @returns {string[]}
 */
export function problemsIn(name, content, options = {}) {
  if (content === undefined || isBinary(content)) return [];
  return findDashes(content.toString("utf8"), options).map(
    ({ line, column }) => `${name}:${line}:${column}: em dash (U+2014)`,
  );
}

/**
 * @param {string[]} argv
 * @param {string} [cwd]
 * @returns {number} the exit code
 */
export function main(argv, cwd = process.cwd()) {
  const { flags, values, rest } = parseArgs(argv);
  /** @type {string[]} */
  const problems = [];
  const message = values.get("message");

  if (message !== undefined) {
    const content = readWorking(cwd, message);
    problems.push(
      ...problemsIn("commit message", content, { skipComments: true }),
    );
  } else if (flags.has("staged")) {
    for (const path of stagedFiles(cwd)) {
      problems.push(...problemsIn(path, readStaged(path, cwd)));
    }
  } else if (rest.length > 0) {
    for (const path of rest) {
      problems.push(...problemsIn(path, readWorking(cwd, path)));
    }
  } else {
    const root = repoRoot(cwd);
    for (const path of trackedFiles(root)) {
      problems.push(...problemsIn(path, readWorking(root, path)));
    }
  }

  return report("check-dashes", problems, ADVICE);
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
