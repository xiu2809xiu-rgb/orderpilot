// Says whether this change needs the two heavy CI jobs, "Docker images" and
// "End-to-end smoke" (ADR 0039). A job's `if:` reads the answer. A job skipped that
// way counts as passed for a required check; a workflow left out by `paths:` would
// leave its check pending for ever.
//
// Usage, in a workflow step with an id:  node scripts/ci/changed-inputs.mjs

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// What neither job is built from or runs. Everything else counts as an input, so a
// new folder runs both jobs until someone decides otherwise here. A miss costs
// minutes; a wrong entry lets a broken image through, so keep this list obvious.
const NEVER = [
  /^docs\//,
  /\.md$/,
  /^samples\//,
  /^\.claude\//,
  /^\.githooks\//,
  /^\.editorconfig$/,
  /^\.gitignore$/,
  /^\.prettierignore$/,
  /^\.prettierrc\.json$/,
  /^\.secretlintrc\.json$/,
  /^commitlint\.config\.js$/,
  /^eslint\.config\.js$/,
  /^lint-staged\.config\.js$/,
  /^osv-scanner\.toml$/,
  /^docker-compose\.samples\.yml$/,
  // Repository scripts, except this one and the smoke test the images job runs.
  /^scripts\/(?!ci\/|stack-smoke\.mjs$)/,
  // GitHub's own files, except the two workflows that hold the jobs.
  /^\.github\/(?!workflows\/(?:ci|docker)\.yml$)/,
];
const NOT_FOR_IMAGES = [/^apps\/e2e\//, /^\.github\/workflows\/ci\.yml$/];
const NOT_FOR_E2E = [
  /^\.trivyignore$/,
  /^scripts\/stack-smoke\.mjs$/,
  /^\.github\/workflows\/docker\.yml$/,
];

/**
 * @param {string} file
 * @param {RegExp[]} patterns
 */
const matches = (file, patterns) => patterns.some((p) => p.test(file));

/**
 * @param {string[]} files
 * @param {RegExp[]} ignored
 */
const counts = (files, ignored) =>
  files.some((file) => !matches(file, NEVER) && !matches(file, ignored));

/**
 * The answer for one event. Only a pull request or a push has a diff to judge: a
 * schedule or a manual run is there to run everything, and so is an empty diff,
 * which nothing should produce.
 *
 * @param {string} event The GitHub event name.
 * @param {string[]} files
 * @returns {{ images: boolean, e2e: boolean }}
 */
export function decide(event, files) {
  const hasDiff = event === "pull_request" || event === "push";
  if (!hasDiff || files.length === 0) return { images: true, e2e: true };
  return {
    images: counts(files, NOT_FOR_IMAGES),
    e2e: counts(files, NOT_FOR_E2E),
  };
}

/**
 * What the commit under test changes against its first parent: on a pull request
 * the checkout is GitHub's merge commit, whose first parent is the base branch, and
 * a merge to main has the previous main there. Renames count as both of their paths.
 *
 * @param {string} cwd
 * @returns {string[]}
 */
export function changedFiles(cwd) {
  const out = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"],
    { cwd, encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

function main() {
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  /** @type {string[]} */
  let files = [];
  let answer = { images: true, e2e: true };
  try {
    files = changedFiles(process.cwd());
    answer = decide(event, files);
  } catch (error) {
    // Running a job needlessly is the safe way to be wrong.
    console.log(
      `::notice::Running every job: no diff to judge. ${String(error)}`,
    );
  }
  console.log(`${event}: ${files.length} changed file(s)`);
  console.log(`Docker images: ${answer.images ? "run" : "skip"}`);
  console.log(`End-to-end smoke: ${answer.e2e ? "run" : "skip"}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `images=${answer.images}\ne2e=${answer.e2e}\n`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
