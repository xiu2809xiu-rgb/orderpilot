// `pnpm api:check`: regenerate the OpenAPI file and the web app's hooks and
// mocks, and fail if any of them changed. A route or schema change that did
// not run `pnpm api:generate` shows up here. It compares file contents, not
// git status, so it gives the same answer in CI and in a dirty working tree.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = "apps/api/openapi.json";
const GENERATED = "apps/web/src/lib/api/generated";

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const absolute = path.join(root, dir);
  try {
    statSync(absolute);
  } catch {
    return [];
  }
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(`${dir}/${entry.name}`)
      : [`${dir}/${entry.name}`],
  );
}

function snapshot() {
  const files = new Map();
  for (const file of [SPEC, ...walk(GENERATED)]) {
    try {
      files.set(file, readFileSync(path.join(root, file), "utf8"));
    } catch {
      // A missing spec is a difference, found below.
    }
  }
  return files;
}

const before = snapshot();
const run = spawnSync("pnpm api:generate", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (run.status !== 0) {
  console.error("api:check: pnpm api:generate failed.");
  process.exit(run.status ?? 1);
}
const after = snapshot();

const names = new Set([...before.keys(), ...after.keys()]);
const changed = [...names]
  .filter((name) => before.get(name) !== after.get(name))
  .sort();

if (changed.length > 0) {
  console.error(
    `api:check: the generated API files are out of date. Run "pnpm api:generate" and commit the result:\n${changed.map((name) => `  ${name}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("api:check: the OpenAPI file and the generated code are current.");
