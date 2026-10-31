# ADR 0029: One local set-up command, and a dev restart that ignores reads

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** Getting started (issue 102)

## Context

A local run of the documented set-up found four faults: the seed failed with TS2307 on a fresh checkout, the build failed with TS2339 after a pull that changed the Prisma schema, the API restarted about ten times in the first minutes of `pnpm dev` with no source file changed, and a copied `.env` showed no demo sign-in.

The restarts needed a measurement. On this Windows machine NTFS last-access updates are on (`fsutil behavior query disablelastaccess` says 2, system managed), and Node's file watcher reports a plain read as a "change". `node --watch` therefore restarted the API whenever it loaded a module it had not read that hour (a file in `node_modules`, then `dist/main.js`), and `tsc --watch` recompiled, and rewrote `dist`, after reading its own sources. A restart count with no edit: 9 in the first 27 seconds of a 5.5 minute idle run, then none. Windows reports the cold-start cost once per file per hour, so a second run looks quiet. That is why the fault was hard to see.

## Decision

1. **`pnpm local:setup` is one idempotent Node script** (`scripts/local-setup.mjs`), not `pnpm setup`, which is pnpm's own command. It copies `.env.example` to `.env` only when `.env` is missing (`COPYFILE_EXCL`), never reads an existing `.env`, starts the stack with `docker compose up -d --wait --no-recreate`, then generates the client, migrates, builds the two workspace packages and seeds. It stops at the first failure and says which step and what to do. Node, not a shell script, so it behaves the same in PowerShell, Git Bash and zsh.
2. **The API's commands prepare themselves.** `apps/api/scripts/prepare.mjs` regenerates the Prisma client when a `.prisma` file is newer than it, and rebuilds `@orderpilot/shared` and `@orderpilot/synthetic-data` when a source is newer than their `dist`. `build`, `typecheck`, `test`, `db:seed`, `api:spec` and `dev` call it. It compares file times and costs milliseconds when nothing is stale. This fixes the cause (a missing or old build) wherever the command is reached from, not one documented order.
3. **`pnpm dev` restarts the API itself.** `apps/api/scripts/dev.mjs` runs `tsc --watch` with polling (`--watchFile` and `--watchDirectory` set to `dynamicPriorityPolling`, which compares last-write times) and starts `dist/main.js` with plain `node`. It watches the built folders and restarts only when a `.js` file's last-write time or size changed, after 400 ms of quiet so one emit restarts once, and it prints the file that caused it. `dist/dev.tsbuildinfo` lets the watcher's first pass find everything up to date.
4. **`.env.example` turns the demo sign-in on** (`DEMO_MODE=true`) with a comment that `APP_ENV=production` refuses it. The API's schema default stays `false`. `CORS_ORIGINS` is built from `WEB_PORT`, so one port line moves both.
5. **A root `pnpm dev`** starts the API and the web app together.

## Consequences

- A teammate runs three commands after cloning: `pnpm install`, `pnpm local:setup`, `pnpm dev`. After a pull: `pnpm install` and `pnpm local:setup`.
- Polling costs a little CPU while `pnpm dev` runs. A real edit is noticed within a few seconds, not instantly.
- `pnpm dev` no longer rebuilds `packages/shared` when its source changes; run `pnpm --filter @orderpilot/shared build` and the API restarts on the new output. This matches how it behaved before.
- The same last-access behaviour can affect any other watcher on Windows.

## Alternatives considered

- **`node --watch-path=dist`.** It watches fewer files but still reports reads of `dist` itself, so the loop remains.
- **Turning off last-access updates** (`fsutil behavior set disablelastaccess 1`). It needs an administrator on every teammate's machine, and CI and macOS are not affected, so the script must not depend on it.
- **`tsx` or another loader.** Ruled out by the rate limiter's decorator metadata (see the top of `dev.mjs`).
- **A Makefile or shell script for set-up.** Not portable to PowerShell.
