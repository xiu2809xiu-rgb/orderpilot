// Keeps .github/CODEOWNERS true to the tree. A rule whose path matches no
// tracked file routes reviews nowhere: either the folder moved and the rule
// did not, or the rule promises a folder that a story has yet to create. A
// story adds its own line when it creates the folder, so every rule here must
// match at least one tracked file.
//
// GitHub reads CODEOWNERS paths by the rules of .gitignore, apart from
// negation and character ranges, which the file does not use. So this check
// asks Git itself which tracked files each path matches, rather than imitating
// those rules. Letter case counts, as it does on GitHub, even on Windows.
//
// Usage:
//   node scripts/check-codeowners.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { git, repoRoot, splitNul } from "./lib/git.mjs";
import { report } from "./lib/report.mjs";

export const CODEOWNERS = ".github/CODEOWNERS";

/**
 * @typedef {{ line: number, pattern: string, owners: string[] }} Rule
 */

/**
 * Reads the rules: one a line, the path first and its owners after it.
 * Blank lines and comments are skipped.
 *
 * @param {string} text
 * @returns {Rule[]}
 */
export function parseRules(text) {
  return text.split(/\r?\n/).flatMap((raw, index) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return [];
    const [pattern = "", ...owners] = trimmed.split(/\s+/);
    return [{ line: index + 1, pattern, owners }];
  });
}

/**
 * The rules that match nothing, one problem line each.
 *
 * @param {Rule[]} rules
 * @param {(pattern: string) => number} countMatches
 * @returns {string[]}
 */
export function unmatchedRules(rules, countMatches) {
  return rules
    .filter((rule) => countMatches(rule.pattern) === 0)
    .map(
      (rule) => `line ${rule.line}: ${rule.pattern} matches no tracked file`,
    );
}

/**
 * How many tracked files a CODEOWNERS path matches, by Git's own matching.
 *
 * @param {string} pattern
 * @param {string} cwd The repository's root, which anchors a leading slash.
 * @returns {number}
 */
export function countTracked(pattern, cwd) {
  const output = git(
    [
      "-c",
      "core.ignoreCase=false",
      "ls-files",
      "--cached",
      "--ignored",
      `--exclude=${pattern}`,
      "-z",
    ],
    { cwd },
  );
  return splitNul(output).length;
}

const ADVICE = [
  "Point each rule at a folder or file that exists, in the same letter case.",
  "A story adds its own line to .github/CODEOWNERS when it creates the folder.",
].join("\n");

/**
 * @param {string} [cwd]
 * @returns {number} the exit code
 */
export function main(cwd) {
  const root = repoRoot(cwd);
  const rules = parseRules(readFileSync(join(root, CODEOWNERS), "utf8"));
  const problems = unmatchedRules(rules, (pattern) =>
    countTracked(pattern, root),
  );
  const code = report("check-codeowners", problems, ADVICE);
  if (code === 0) {
    console.log(
      `check-codeowners: all ${rules.length} rules in ${CODEOWNERS} match a tracked file.`,
    );
  }
  return code;
}

if (import.meta.main) {
  process.exitCode = main();
}
