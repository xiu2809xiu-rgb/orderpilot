# Getting started

How to get OrderPilot running on your own machine from a clean clone. The same steps are in [CONTRIBUTING.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/CONTRIBUTING.md#set-up), which is the version to fix first when a step is wrong.

## Set-up

Follow these steps in order on a fresh machine. They are tested on Windows 11 (PowerShell and Git Bash). They are written for macOS (zsh) too, but nobody has run them there yet: if a macOS step fails, tell Richie and fix this page in the same pull request.

Every command is the same in PowerShell, Git Bash and macOS (zsh) unless the step shows each one.

## Prerequisites

| You need | Version                                                                                                                      | Check it                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Git      | any recent                                                                                                                   | `git --version`          |
| Node.js  | 24.22 or newer 24.x (the version in [`.node-version`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/.node-version)) | `node --version`         |
| pnpm     | 12                                                                                                                           | `pnpm --version`         |
| Docker   | Docker Desktop on Windows and macOS, Docker Engine on Linux, with Compose                                                    | `docker compose version` |

Install pnpm with `npm install -g pnpm@12.14.0`. On macOS `corepack enable` works too; on Windows it needs an administrator prompt, so use npm. Start Docker Desktop before the set-up and wait until it says it is running.

## 1. Clone

```sh
git clone https://github.com/xiu2809xiu-rgb/orderpilot.git
cd orderpilot
```

## 2. Set your no-reply email

Commit with your GitHub no-reply email, never a school email. You will find it on GitHub under Settings, Emails. On that page, also turn on **Keep my email addresses private**: GitHub writes merge commits with your no-reply address only then.

```sh
git config user.email "<your GitHub no-reply address>"
```

## 3. Install

```sh
pnpm install
```

This installs the packages, generates the Prisma client and installs the Git hooks. It prints `Git hooks installed: core.hooksPath is .githooks.` If you installed before the hooks existed, pnpm skips that step when nothing else changed, so run `pnpm run prepare` once.

## 4. Set up the local stack

```sh
pnpm local:setup
```

(Not `pnpm setup`: that is pnpm's own command.) One command does the rest of the set-up, and it is safe to run again after every pull. In order, it:

1. copies `.env.example` to `.env` if there is no `.env` yet. It never overwrites a `.env` you have and never reads one;
2. checks that Docker is running, and says so clearly if it is not;
3. starts PostgreSQL (with pgvector), Redis, MinIO and Mailpit with `docker compose up -d --wait --no-recreate`, which leaves running containers alone;
4. generates the Prisma client and applies the migrations;
5. builds `@orderpilot/shared` and `@orderpilot/synthetic-data`, which the API and the seed import;
6. seeds the nine demo accounts (safe to run twice).

It stops at the first step that fails, says which one, and says what to do. The first run compiles MinIO, which takes a few minutes. Later runs take seconds.

## 5. Run

```sh
pnpm dev
```

This runs the API and the web app together and restarts the API when you save a file. Leave the terminal open. When you see `Nest application successfully started` and a Vite line with a local address, open:

- the web app, <http://localhost:5173>;
- the API's health check, <http://localhost:3000/health/ready> (database, Redis and storage should say `up`), and its Swagger page, <http://localhost:3000/api/docs>;
- Mailpit, which catches all email, <http://127.0.0.1:8025>.

- the `.http` files in [`apps/api/requests`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/apps/api/requests), in VS Code (REST Client) or a JetBrains IDE.

To run the built API instead: `pnpm --filter @orderpilot/api build`, then `pnpm --filter @orderpilot/api start`. `pnpm stack:down` stops the containers and keeps your data. The layers and patterns are in [docs/architecture](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/architecture/README.md). The database, and how to change it, is in [ADR 0010](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/adr/0010-prisma-with-postgresql.md): edit your area's file in `apps/api/prisma/schema/`, run `pnpm db:migrate:dev`, and commit the schema and the new migration together.

## 6. Sign in

`.env.example` sets `DEMO_MODE=true`, so the sign-in page shows one button per role, nine in all, with no password. Choose a role to sign in; sign out is in the user menu. `APP_ENV=production` refuses `DEMO_MODE=true`, so a production setting cannot keep it by mistake. To sign in with a password instead, use `system.admin@example.test` (or another role's address, such as `approver@example.test`) and `DEMO_PASSWORD` from `.env`.

## 7. Check that everything passes

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The API's integration tests use the stack, so run `pnpm local:setup` first. Read [CLAUDE.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/CLAUDE.md), [AGENTS.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/AGENTS.md) and the [working agreement](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/working-agreement.md) too.

To try the API by hand, open `apps/api/requests/auth.http`. To see what a role may do, read `DEFAULT_ROLE_PERMISSIONS` in `packages/shared/src/permissions.ts`. Refused calls and every sign-in appear in the audit trail.

Line endings need no set-up. [`.gitattributes`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/.gitattributes) keeps text files LF on every machine, even with `core.autocrlf` on.

## What `.env` loading does

One `.env` at the repository root is enough. Its values are safe for a laptop and are not secrets. `.env` is never committed.

- **Who reads it.** The API reads `apps/api/.env` first, then the root `.env`. The Prisma commands (`pnpm db:migrate` and the others) read the same files by the same rules. Docker Compose reads the root `.env` itself for the ports and passwords. The web app's Vite server reads only `API_PORT` and `WEB_PORT` from it. `pnpm local:setup` never reads it.
- **The shell wins.** A variable already set in your shell, in CI or by Docker is never overridden by a file. A file that is missing is skipped.
- **References.** A value may use another, such as `${POSTGRES_PORT}`, so one line moves every URL built from it.
- **Missing values.** If something required is missing, the API stops and names the file to create.

## Change a port

The ports are lines in `.env`. Change one line and every URL built from it moves with it.

| Line                                                                                                      | What it moves                                                                                      |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `API_PORT`                                                                                                | The API. The web app's proxy follows it                                                            |
| `WEB_PORT`                                                                                                | The web app. `CORS_ORIGINS` follows it                                                             |
| `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT` | The containers, and every URL built from them                                                      |
| `GRAFANA_PORT`, `OTLP_GRPC_PORT`, `OTLP_HTTP_PORT`                                                        | The optional observability profile only (`docker compose --profile observability up -d otel-lgtm`) |

- **Before your first run** (a port is already taken): copy `.env.example` to `.env` yourself, edit the line, then run `pnpm local:setup`. It keeps the `.env` you made. The copy is `cp .env.example .env` in Git Bash and macOS (zsh), and `Copy-Item .env.example .env` in PowerShell.
- **After a first run:** edit the line. `API_PORT` and `WEB_PORT` apply when you restart `pnpm dev`. A container port applies when the container is recreated, and `pnpm local:setup` deliberately never recreates containers, so run `docker compose up -d --wait` once. It recreates only the containers whose port changed, and their data stays in the Docker volumes.
- **For one run only**, set the variable in the shell, which always wins over the file:

```sh
API_PORT=3100 pnpm dev            # Git Bash, macOS (zsh)
```

```powershell
$env:API_PORT = 3100; pnpm dev    # PowerShell
```

A second clone on the same machine needs its own ports and its own Docker project name, because the project is called `orderpilot` in `docker-compose.yml`. Set `COMPOSE_PROJECT_NAME` in the shell (`export COMPOSE_PROJECT_NAME=orderpilot-two`, PowerShell: `$env:COMPOSE_PROJECT_NAME = "orderpilot-two"`) before `pnpm local:setup`, and keep it set while you work in that clone.

## After a pull

```sh
git pull
pnpm install       # when pnpm-lock.yaml changed
pnpm local:setup   # new migrations, a new Prisma schema, changed packages, new seed data
```

`pnpm local:setup` is the whole answer. Separately, the API's `build`, `dev`, `typecheck`, `test` and `db:seed` commands each regenerate the Prisma client when a schema file is newer than it, and rebuild the shared packages when their sources are newer, so none of them fails on a stale build.

## The GitHub scripts

The labels, milestones, backlog, board and wiki are kept as code in [`scripts/github/`](https://github.com/xiu2809xiu-rgb/orderpilot/tree/main/scripts/github). They need Node 24 and the [GitHub CLI](https://cli.github.com/), signed in with `gh auth login`, and nothing else. Two of them are for every day:

```sh
node scripts/github/sprint-report.mjs
node scripts/github/day-note.mjs "Merged P-3. P-4 in progress."
```

The first prints what closed this sprint and what is in progress, by area. The second adds the daily note to the current milestone. The [scripts' README](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/scripts/github/README.md) has the rest, and their tests run with:

```sh
node --test "scripts/github/**/*.test.mjs"
```

## Troubleshooting

**`pnpm local:setup` stops at a step.** It says which step failed and what to do. Fix that, then run it again: every step is safe to repeat.

**`pnpm local:setup` says Docker is not running.** Start Docker Desktop (Windows, macOS) and wait until it says it is running, then run it again. On Linux: `sudo systemctl start docker`.

**`The system cannot find the path specified` from pnpm (Windows).** Windows stops paths at 260 characters, and pnpm writes long file names under `node_modules`. Clone into a short folder such as `C:Users<you>orderpilot`, not deep inside OneDrive or Documents.

**`TS2307: Cannot find module '@orderpilot/shared'`** (or `synthetic-data`). The shared packages are not built. The API's `build`, `dev` and `db:seed` commands build them when needed, so this means a package ran without them: run `pnpm local:setup`, or `pnpm --filter @orderpilot/shared --filter @orderpilot/synthetic-data build`.

**`TS2339: Property ... does not exist` after a pull.** The Prisma schema changed and the generated client is old. The API's `build`, `dev`, `typecheck` and `test` regenerate it when a schema file is newer. If you see this anyway, run `pnpm db:generate`.

**The sign-in page has no role buttons.** `DEMO_MODE` is not `true` in your `.env`. A `.env` copied before 1 November 2026 has `DEMO_MODE=false`. Set it to `true` and restart `pnpm dev`.

**The web app says 502 on sign-in.** The API is not answering: it is starting, it stopped, or `API_PORT` in `.env` is not the port the API listens on. Look at the `pnpm dev` output for `Nest application successfully started`, or for the error that stopped it.

**The API restarts when you have changed nothing (Windows).** It should not any more. Windows can report a file as changed when it is only read, and `node --watch` restarted the API every time it loaded a module. `pnpm dev` restarts the API only when a built file was really rewritten, and it prints which one. If you still see restarts with no edit, copy the lines that say why into the issue.

**`Port 5173 is already in use`** from the web app, or `EADDRINUSE` from the API. Another program, or a second `pnpm dev`, holds it. Stop that, or change `WEB_PORT` or `API_PORT` in `.env`.

**Docker is not running.** `docker compose up` says it cannot connect to the Docker daemon, or the tests say that nothing answers on the database port. Start Docker Desktop (Windows and macOS) and wait until it says it is running, then run `docker compose up -d --wait` again. On Linux: `sudo systemctl start docker`.

**Port already in use.** `docker compose up` says a port is already allocated or already in use. Something else on your machine has 5432 (PostgreSQL), 6379 (Redis), 9000 or 9001 (MinIO), 1025 or 8025 (Mailpit). Either stop it, or move the stack: change one line in your `.env`, for example `POSTGRES_PORT=5433`, and run `docker compose up -d --wait` again. The database URLs are built from the port, so nothing else needs to change. To see who holds a port: `netstat -ano | findstr :5432` (PowerShell and Command Prompt) or `lsof -i :5432` (macOS and Linux).

**`role "orderpilot" does not exist`** (or `password authentication failed`). Another PostgreSQL is answering on the port, usually one installed on your machine, not the one in Docker. Our database never saw the request. Stop the other one, or give ours a free port with `POSTGRES_PORT=5433` in `.env` and run `docker compose up -d --wait` again. `docker compose ps` shows which ports our containers hold.

**Changed `.env` and nothing moved.** A variable set in your shell wins over the file, and the API never overrides it. Check with `echo $POSTGRES_PORT` (PowerShell: `$env:POSTGRES_PORT`), and unset it. Then run `docker compose up -d --wait` so the containers pick up the new ports.

**The first `docker compose up` takes minutes.** It compiles MinIO from its source once. Later starts use the cached image.

**Start again from nothing.** `docker compose down` stops and removes the containers and keeps your data. Removing the data too (`docker compose down -v`) deletes the volumes: ask first, and know that it cannot be undone.

## What later stories bring

| Step                                            | Story |
| ----------------------------------------------- | ----- |
| The full stack with `docker compose up --build` | P-13  |
| End-to-end tests with Playwright and axe        | P-14  |
