// Keeps the UI kits' licence keys out of Git. The keys live only in
// apps/web/.env.local (CLAUDE.md section 5), which Git ignores, and
// components.json refers to them only as ${...}. This check reads the real
// values on this machine and refuses any file that contains one. It never
// prints a value: a report names the file and the variable only.
//
// It also refuses an env file itself (.env, .env.local and the like), which
// `git add -f` could otherwise slip past the ignore rule. .env.example is the
// one env file that is tracked.
//
// Usage:
//   node scripts/check-licence-key.mjs           every tracked file
//   node scripts/check-licence-key.mjs --staged  what the next commit would write
//
// ORDERPILOT_LICENCE_ENV_FILE points the check at another env file; the tests
// use it with fake keys.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isBinary,
  readStaged,
  readWorking,
  repoRoot,
  stagedFiles,
  trackedFiles,
} from "./lib/git.mjs";
import { report } from "./lib/report.mjs";

export const KEY_NAMES = ["REACTBITS_LICENSE_KEY", "REUI_LICENSE_KEY"];
export const ENV_FILE = "apps/web/.env.local";

// Shorter values are placeholders, not keys, and would match by accident.
const MIN_KEY_LENGTH = 8;

const ADVICE = [
  "Licence keys live only in apps/web/.env.local, which Git ignores.",
  "Remove the key from these files, refer to it as ${NAME} instead, and unstage",
  "any env file with: git rm --cached <file>",
  "If a key was already pushed, tell Richie at once: it must be rotated.",
].join("\n");

/**
 * Reads KEY=value lines. Quotes around a value are removed; comments and
 * blank lines are skipped.
 *
 * @param {string} text
 * @returns {Map<string, string>}
 */
export function parseEnv(text) {
  const values = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match) continue;
    const [, name = "", rawValue = ""] = match;
    let value = rawValue.trim();
    const quoted = /^(["'])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2] ?? "";
    values.set(name, value);
  }
  return values;
}

/**
 * The licence key values set on this machine, from the env file and from the
 * environment, by variable name.
 *
 * @param {string} root
 * @param {NodeJS.ProcessEnv} env
 * @returns {Map<string, string>}
 */
export function loadKeys(root, env = process.env) {
  const file = env["ORDERPILOT_LICENCE_ENV_FILE"] ?? resolve(root, ENV_FILE);
  /** @type {Map<string, string>} */
  let fromFile = new Map();
  try {
    fromFile = parseEnv(readFileSync(file, "utf8"));
  } catch {
    // No env file means no keys on this machine, which is normal.
  }
  /** @type {Map<string, string>} */
  const byValue = new Map();
  for (const name of KEY_NAMES) {
    for (const value of [fromFile.get(name), env[name]]) {
      if (
        value !== undefined &&
        value.length >= MIN_KEY_LENGTH &&
        !value.startsWith("${")
      ) {
        byValue.set(value, name);
      }
    }
  }
  return byValue;
}

/**
 * Whether a path is an env file that must never be committed.
 *
 * @param {string} path
 */
export function isEnvFile(path) {
  const name = path.split("/").at(-1) ?? "";
  return name.startsWith(".env") && name !== ".env.example";
}

/**
 * @param {string} path
 * @param {Buffer | undefined} content
 * @param {Map<string, string>} keys value to variable name
 * @returns {string[]}
 */
export function problemsIn(path, content, keys) {
  /** @type {string[]} */
  const problems = [];
  if (isEnvFile(path)) {
    problems.push(`${path}: env files are never committed`);
  }
  if (content === undefined || isBinary(content) || keys.size === 0) {
    return problems;
  }
  const text = content.toString("utf8");
  for (const [value, name] of keys) {
    if (text.includes(value)) {
      problems.push(`${path}: contains the value of ${name}`);
    }
  }
  return problems;
}

/**
 * @param {string[]} argv
 * @param {string} [cwd]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number} the exit code
 */
export function main(argv, cwd = process.cwd(), env = process.env) {
  const root = repoRoot(cwd);
  const keys = loadKeys(root, env);
  /** @type {string[]} */
  const problems = [];

  if (argv.includes("--staged")) {
    for (const path of stagedFiles(root)) {
      problems.push(...problemsIn(path, readStaged(path, root), keys));
    }
  } else {
    for (const path of trackedFiles(root)) {
      problems.push(...problemsIn(path, readWorking(root, path), keys));
    }
  }

  return report("check-licence-key", problems, ADVICE);
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
