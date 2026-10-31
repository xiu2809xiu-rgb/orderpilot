// `pnpm dev`: rebuild on every change and restart the API.
//
// tsx and similar loaders compile with esbuild, which breaks Nest's
// dependency injection for libraries that rely on emitted metadata (the rate
// limiter's guard does). So the API always runs the output of tsc, exactly as
// it runs in production.
//
// Two things here are deliberate, and both come from Windows:
//
// 1. The API is restarted by this script, not by `node --watch`. On Windows,
//    reading a file fires a "change" event (NTFS last-access updates), so
//    `node --watch` restarted the API about ten times in the first minutes,
//    each time it loaded a module it had not read that hour, and a sign-in
//    during a restart got a 502 from the web app's proxy. Here the API restarts
//    only when a built file's last-write time or size changed.
// 2. tsc polls file times instead of listening for events, for the same
//    reason: its own reads of the sources made it recompile (and rewrite
//    dist) when nothing had been edited.

import { spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { changedFiles, snapshot } from "./dist-snapshot.mjs";
import { ensurePrismaClient, ensureWorkspaceBuilt } from "./prepare.mjs";

const require = createRequire(import.meta.url);
const tsc = require.resolve("typescript/bin/tsc");
const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/** Built output the API loads: its own, and the two workspace packages'. */
const WATCHED = [
  here("../dist"),
  here("../../../packages/shared/dist"),
  here("../../../packages/synthetic-data/dist"),
];
/** How long to wait after the last file event, so one tsc emit restarts once. */
const SETTLE_MS = 400;

ensurePrismaClient();
ensureWorkspaceBuilt();

// dist/dev.tsbuildinfo lets tsc --watch find its first pass up to date instead
// of rewriting every file. It lives in dist, so deleting dist resets it.
const TSC_ARGS = [
  tsc,
  "-p",
  "tsconfig.build.json",
  "--incremental",
  "--tsBuildInfoFile",
  "dist/dev.tsbuildinfo",
];

const first = spawnSync(process.execPath, TSC_ARGS, { stdio: "inherit" });
if (first.status !== 0) process.exit(first.status ?? 1);

let api;
let stopping = false;
let restarting = false;

function startApi() {
  console.log("Starting the API...");
  api = spawn(process.execPath, ["dist/main.js"], { stdio: "inherit" });
  api.on("exit", (code) => {
    if (stopping || restarting) return;
    console.log(
      `The API exited with code ${code}. Waiting for a change to start it again.`,
    );
  });
}

function restartApi(why) {
  console.log(`Restarting the API (${why})...`);
  restarting = true;
  const old = api;
  const start = () => {
    restarting = false;
    startApi();
  };
  if (old.exitCode !== null || old.signalCode !== null) start();
  else {
    old.once("exit", start);
    old.kill();
  }
}

const compiler = spawn(
  process.execPath,
  [
    ...TSC_ARGS,
    "--watch",
    "--preserveWatchOutput",
    "--watchFile",
    "dynamicPriorityPolling",
    "--watchDirectory",
    "dynamicPriorityPolling",
  ],
  { stdio: "inherit" },
);

let known = snapshot(WATCHED);
let timer;
function onFileEvent() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const now = snapshot(WATCHED);
    const changed = changedFiles(known, now);
    if (changed.length === 0) return;
    known = now;
    restartApi(
      `${changed.length} built file(s) changed, for example ${changed[0]}`,
    );
  }, SETTLE_MS);
}

const watchers = [];
for (const folder of WATCHED) {
  try {
    watchers.push(watch(folder, { recursive: true }, onFileEvent));
  } catch {
    // The folder does not exist yet. The two packages' dist is built above.
  }
}

startApi();

function stop() {
  stopping = true;
  clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  api.kill();
  compiler.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
compiler.on("exit", stop);
