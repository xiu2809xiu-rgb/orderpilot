// What the API needs before it can be compiled or run, whatever command you
// reach it by (`pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm db:seed`):
//
//   client  the Prisma client in src/generated/prisma, rebuilt when a .prisma
//           file is newer than it. Without this, a pull that changes the
//           schema breaks the build with TS2339 until `prisma generate` runs.
//   deps    @orderpilot/shared and @orderpilot/synthetic-data, which the API
//           imports from their build output, rebuilt when a source file is
//           newer than it. Without this, a fresh checkout breaks with TS2307.
//
// Each check compares file times and does nothing when the output is current,
// so running it before every command costs a few milliseconds.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const API_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES_ROOT = join(API_ROOT, "../../packages");
const WORKSPACE_PACKAGES = ["shared", "synthetic-data"];

/** The newest modification time under `path` (a file or a folder), or 0. */
export function newestMtime(path, include = () => true) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return include(path) ? stat.mtimeMs : 0;
  let newest = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(join(path, entry.name), include));
  }
  return newest;
}

/**
 * True when `output` is missing or older than anything in `inputs`.
 *
 * @param {string[]} inputs files or folders
 * @param {string} output a file the build writes
 * @param {(path: string) => boolean} [include] which input files count
 */
export function isStale(inputs, output, include = () => true) {
  if (!existsSync(output)) return true;
  const built = statSync(output).mtimeMs;
  return inputs.some((input) => newestMtime(input, include) > built);
}

function run(label, args, cwd) {
  console.log(label);
  const result = spawnSync(process.execPath, args, {
    cwd,
    stdio: "inherit",
    // No update notice or telemetry check from the Prisma CLI.
    env: {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
      CHECKPOINT_DISABLE: "1",
    },
  });
  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

export function ensurePrismaClient() {
  const schema = join(API_ROOT, "prisma/schema");
  const client = join(API_ROOT, "src/generated/prisma/client.ts");
  if (!isStale([schema], client, (file) => file.endsWith(".prisma"))) return;
  const prisma = require.resolve("prisma/build/index.js");
  run("Generating the Prisma client...", [prisma, "generate"], API_ROOT);
}

export function ensureWorkspaceBuilt() {
  for (const name of WORKSPACE_PACKAGES) {
    const root = join(PACKAGES_ROOT, name);
    const stamp = join(root, "dist/index.js");
    const inputs = [join(root, "src"), join(root, "tsconfig.build.json")];
    // The synthetic data is built on the shared schemas.
    if (name !== "shared") inputs.push(join(PACKAGES_ROOT, "shared/dist"));
    if (!isStale(inputs, stamp)) continue;
    run(
      `Building @orderpilot/${name}...`,
      [tsc, "-p", join(root, "tsconfig.build.json")],
      root,
    );
  }
}

const TARGETS = {
  client: [ensurePrismaClient],
  deps: [ensureWorkspaceBuilt],
  all: [ensurePrismaClient, ensureWorkspaceBuilt],
};

if (import.meta.main) {
  const target = process.argv[2] ?? "all";
  const steps = TARGETS[target];
  if (!steps) {
    console.error(`Unknown target "${target}". Use client, deps or all.`);
    process.exit(2);
  }
  for (const step of steps) step();
}
