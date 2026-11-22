# Contributing to OrderPilot

Everyone on the team follows this guide, whichever tools they use. [CLAUDE.md](CLAUDE.md) holds the product brief and the standards. If you use an AI tool, it must follow [AGENTS.md](AGENTS.md).

## Set-up

Follow these steps in order on a fresh machine. They are tested on Windows 11 (PowerShell and Git Bash). They are written for macOS (zsh) too, but nobody has run them there yet: if a macOS step fails, tell Richie and fix this page in the same pull request.

Every command is the same in PowerShell, Git Bash and macOS (zsh) unless the step shows each one.

### Prerequisites

| You need | Version                                                                   | Check it                 |
| -------- | ------------------------------------------------------------------------- | ------------------------ |
| Git      | any recent                                                                | `git --version`          |
| Node.js  | 24.22 or newer 24.x (the version in [`.node-version`](.node-version))     | `node --version`         |
| pnpm     | 12                                                                        | `pnpm --version`         |
| Docker   | Docker Desktop on Windows and macOS, Docker Engine on Linux, with Compose | `docker compose version` |

Install pnpm with `npm install -g pnpm@12.14.0`. On macOS `corepack enable` works too; on Windows it needs an administrator prompt, so use npm. Start Docker Desktop before the set-up and wait until it says it is running.

### 1. Clone

```sh
git clone https://github.com/xiu2809xiu-rgb/orderpilot.git
cd orderpilot
```

### 2. Set your no-reply email

Commit with your GitHub no-reply email, never a school email. You will find it on GitHub under Settings, Emails. On that page, also turn on **Keep my email addresses private**: GitHub writes merge commits with your no-reply address only then.

```sh
git config user.email "<your GitHub no-reply address>"
```

### 3. Install

```sh
pnpm install
```

This installs the packages, generates the Prisma client and installs the Git hooks. It prints `Git hooks installed: core.hooksPath is .githooks.` If you installed before the hooks existed, pnpm skips that step when nothing else changed, so run `pnpm run prepare` once.

### 4. Set up the local stack

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

### 5. Run

```sh
pnpm dev
```

This runs the API and the web app together and restarts the API when you save a file. Leave the terminal open. When you see `Nest application successfully started` and a Vite line with a local address, open:

- the web app, <http://localhost:5173>;
- the API's health check, <http://localhost:3000/health/ready> (database, Redis and storage should say `up`), and its Swagger page, <http://localhost:3000/api/docs>;
- Mailpit, which catches all email, <http://127.0.0.1:8025>.

- the `.http` files in [`apps/api/requests`](apps/api/requests), in VS Code (REST Client) or a JetBrains IDE.

To run the built API instead: `pnpm --filter @orderpilot/api build`, then `pnpm --filter @orderpilot/api start`. `pnpm stack:down` stops the containers and keeps your data. The layers and patterns are in [docs/architecture](docs/architecture/README.md). The database, and how to change it, is in [ADR 0010](docs/adr/0010-prisma-with-postgresql.md): edit your area's file in `apps/api/prisma/schema/`, run `pnpm db:migrate:dev`, and commit the schema and the new migration together.

### 6. Sign in

`.env.example` sets `DEMO_MODE=true`, so the sign-in page shows one button per role, nine in all, with no password. Choose a role to sign in; sign out is in the user menu. `APP_ENV=production` refuses `DEMO_MODE=true`, so a production setting cannot keep it by mistake. To sign in with a password instead, use `system.admin@example.test` (or another role's address, such as `approver@example.test`) and `DEMO_PASSWORD` from `.env`.

### 7. Check that everything passes

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The API's integration tests use the stack, so run `pnpm local:setup` first. Read [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) and the [working agreement](docs/agile/working-agreement.md) too.

Line endings need no set-up. [`.gitattributes`](.gitattributes) keeps text files LF on every machine, even with `core.autocrlf` on.

### What `.env` loading does

One `.env` at the repository root is enough. Its values are safe for a laptop and are not secrets. `.env` is never committed.

- **Who reads it.** The API reads `apps/api/.env` first, then the root `.env`. The Prisma commands (`pnpm db:migrate` and the others) read the same files by the same rules. Docker Compose reads the root `.env` itself for the ports and passwords. The web app's Vite server reads only `API_PORT`, `WEB_PORT` and the developer switch `VITE_SHOW_PLANNED` from it (see below). `pnpm local:setup` never reads it.
- **The shell wins.** A variable already set in your shell, in CI or by Docker is never overridden by a file. A file that is missing is skipped.
- **References.** A value may use another, such as `${POSTGRES_PORT}`, so one line moves every URL built from it.
- **Missing values.** If something required is missing, the API stops and names the file to create.

### Add an AI provider's key

The API answers from the mock, which is offline, until the root `.env` names a real provider. Put the key in with one command, so it is never typed into a chat, a file by hand or a screen:

```sh
pnpm ai:key
```

It asks which provider (`gemini`, the default, or `groq`), then the key (in a terminal nothing shows as you type or paste), then the model id. The id has no default because providers rename and retire models often, and the question says where to find the current ones. It then sets `AI_PROVIDER`, the provider's key variable (`GEMINI_API_KEY` or `GROQ_API_KEY`) and `AI_MODEL` in the root `.env`, creating that file from `.env.example` if it is missing, and keeps every other line as it was.

- **It never shows the key.** Not on screen, not in a log, not even in part: in a terminal nothing shows as you type or paste. It can only hide the key where the terminal gives it a real keyboard input, so in a terminal that does not (for example Git Bash without winpty) it refuses with one line and changes nothing. Run it in PowerShell, Windows Terminal or the VS Code terminal. An empty or malformed answer changes nothing, and so does Ctrl+C.
- **It sends nothing anywhere.** The key is checked by the gateway, not by this command: restart the API (Ctrl+C on `pnpm dev`, then start it again), sign in as System admin and send the probe request in `apps/api/requests/ai.http`. The answer says `ok`, `error` or `timeout` with a reason code, and never a key.
- **Where it can be overruled.** A variable set in your shell wins over the file, and `apps/api/.env`, if you have one, is read before the root `.env`. The command says so when it sees either.
- **Only synthetic data may be sent to a real provider,** and a free tier may keep what it is sent.

### Change a port

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

### Seeing screens that are not built yet

The menu, the routes, Ctrl+K and the home page show only what exists. A screen that is still a placeholder (a feature marked `planned: true` in its `index.ts`) is left out, and its address shows the not-found page, the same as any unknown address. To see what is coming, set `VITE_SHOW_PLANNED=true` in the root `.env` and restart `pnpm dev`. It works only in the development server, and it is off by default so your screenshots look like production. A production build never contains the placeholder or its text, and `pnpm budget` fails if it does.

### After a pull

```sh
git pull
pnpm install       # when pnpm-lock.yaml changed
pnpm local:setup   # new migrations, a new Prisma schema, changed packages, new seed data
```

`pnpm local:setup` is the whole answer. Separately, the API's `build`, `dev`, `typecheck`, `test` and `db:seed` commands each regenerate the Prisma client when a schema file is newer than it, and rebuild the shared packages when their sources are newer, so none of them fails on a stale build.

### Run the web app

The web app is `apps/web` (`@orderpilot/web`). `pnpm dev` (step 5) already starts it, with the API. Its pages need the API for a real sign-in. These commands run it on its own:

```sh
pnpm --filter @orderpilot/web dev        # http://localhost:5173, with /api proxied to the API
pnpm --filter @orderpilot/web build      # type-check, then a production build in apps/web/dist
pnpm --filter @orderpilot/web preview    # serve that build with the production security headers
pnpm budget                              # initial JS must be 250 KB gzip or less (run after a build)
pnpm --filter @orderpilot/web test       # component and unit tests
```

- **Ports:** `WEB_PORT` (default 5173) and `API_PORT` (default 3000) are in [`.env.example`](.env.example). Vite reads only those two names from the root `.env`.
- **Demo sign-in:** with `DEMO_MODE=true` (the default in `.env.example`), the login page lists the nine roles. Without the API running, the page loads but cannot sign in.
- **Where things are:** each area's screens go in `apps/web/src/features/<feature>/`; the shell, router and guards are in `src/app/`; text is in `src/locales/en/`. [ADR 0013](docs/adr/0013-the-web-stack.md) explains the layout.
- **Screenshots** for a pull request come from `apps/web/scripts/screenshots.mjs`, which still needs Playwright installed outside the repository (the top of the file says how). Moving it onto `apps/e2e` is in the backlog (P-79).

### The full stack in Docker

`docker compose up --build` builds and starts everything, on a fresh clone with no `.env` at all: the four stores, then the migrations and the seed, then the API, the worker and the web app, each waiting until what it needs is healthy. The first build takes a few minutes, because MinIO compiles from source; later builds reuse the cache. [ADR 0031](docs/adr/0031-docker-and-the-deployment-target.md) explains the images.

- Open <http://localhost:8080> (`STACK_WEB_PORT`) and sign in as any role. nginx serves the production build and hands `/api/` to the API, which has no host port of its own.
- `pnpm stack:smoke` checks the running stack as a browser would: the security headers, the SPA fallback, caching, the proxy and a demo sign-in.
- It shares the stores with `pnpm dev`, and none of its ports clash, so both can run at once.
- The mock services start only when asked: `docker compose --profile mocks up -d --build mock-template`.
- Screenshots for a pull request come from this stack (CLAUDE.md, rule 3).

### Run the end-to-end tests

The browser tests in `apps/e2e` run against a stack that is already up, and start nothing themselves ([ADR 0034](docs/adr/0034-playwright-end-to-end-tests.md)). Once per machine, download Chromium; then bring the full stack up and run them:

```sh
pnpm --filter @orderpilot/e2e exec playwright install chromium
docker compose up --build -d --wait
pnpm e2e
```

- `pnpm e2e` signs in as each of the nine roles, so the default sign-in limit of 20 a minute is too tight for repeated runs. Set `AUTH_RATE_LIMIT_MAX_REQUESTS=1000` in the root `.env` and run `docker compose up -d --wait` again, as CI does. Leave `DEMO_MODE=true`: the tests sign in through the demo route.
- `E2E_BASE_URL=http://localhost:5173 pnpm e2e` runs them against `pnpm dev` or any other stack instead.
- `pnpm e2e -- -g "Auditor"` runs only the tests whose title matches. `pnpm --filter @orderpilot/e2e e2e:report` opens the last report.
- Never run them against the live demo: they sign in as every role and leave audit events.

### Trying a client sample

Read [`samples/README.md`](samples/README.md) first. `pnpm samples:up` starts a second, sealed stack on <http://localhost:8081> (`SAMPLES_WEB_PORT`): its own compose project, its data in memory, no route to the internet and no outside name resolution from any container (restart web only with `pnpm samples:restart-web`), and `samples/` mounted read-only. `pnpm samples:down` deletes it, data and all.

### The root scripts

| Command                    | What it does                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                | ESLint over the whole repository, failing on any warning                                                                      |
| `pnpm typecheck`           | TypeScript over the scripts, then each package's own `typecheck`                                                              |
| `pnpm test`                | The repository's `node --test` tests, then each package's own `test`. The API's integration tests need the stack up           |
| `pnpm build`               | Each package's own `build`                                                                                                    |
| `pnpm format`              | Prettier writes every file. Mass formatting: ask first (AGENTS.md, rule 4)                                                    |
| `pnpm format:check`        | Prettier checks every file and writes nothing                                                                                 |
| `pnpm check:dashes`        | No em dash in any tracked text file                                                                                           |
| `pnpm check:samples`       | No client sample in any tracked file; `check:samples:history` checks every commit                                             |
| `pnpm check:licence-key`   | No licence key value and no env file in any tracked file                                                                      |
| `pnpm check:secrets`       | secretlint over the whole working tree                                                                                        |
| `pnpm local:setup`         | The whole set-up, safe to repeat after a pull: `.env` if missing, the stack, Prisma client, migrations, shared packages, seed |
| `pnpm ai:key`              | Asks for an AI provider, its key (hidden) and a model id, and sets them in the root `.env`                                    |
| `pnpm dev`                 | The API and the web app together, restarting the API when you save a file                                                     |
| `pnpm stack:up`            | `docker compose up -d --wait` for the four stores only: PostgreSQL, Redis, MinIO and Mailpit, healthy before it returns       |
| `pnpm stack:down`          | `docker compose down`: stops and removes the containers, keeps the data                                                       |
| `pnpm stack:smoke`         | Checks a running full stack from outside, on `STACK_WEB_PORT`                                                                 |
| `pnpm e2e`                 | The browser tests in `apps/e2e` against a running stack: the smoke test of every role and each screen's spec                  |
| `pnpm samples:up`          | Builds and starts the sealed samples stack                                                                                    |
| `pnpm samples:restart-web` | Restarts the web container of the samples stack and seals it again                                                            |
| `pnpm samples:down`        | Stops and deletes the samples stack and everything it held                                                                    |
| `pnpm db:migrate`          | Applies pending migrations to the development database                                                                        |
| `pnpm db:migrate:dev`      | Creates a migration after you edit a `.prisma` file                                                                           |
| `pnpm db:generate`         | Rebuilds the Prisma client (`pnpm install` does it too)                                                                       |
| `pnpm db:seed`             | Seeds the development database; safe to run again                                                                             |

### The Git hooks

`pnpm install` points Git at [`.githooks/`](.githooks). They run with Git Bash on Windows and with sh on macOS, and need Node on `PATH`.

| Hook       | What it checks                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| commit-msg | [Conventional Commits](https://www.conventionalcommits.org/) through commitlint, and no em dash                   |
| pre-commit | No licence key, no client sample and no em dash in the staged files, then secretlint, ESLint and Prettier on them |
| pre-push   | Nothing is pushed to `main`, whatever the command, and no client sample is in any commit being pushed             |

If a hook stops you, it says why and what to do. When it refuses a push to `main`, push your branch instead (`git push -u origin <branch>`) and open a pull request. Never skip a hook with `--no-verify`. [Security testing](docs/security/security-testing.md) lists every check.

#### Several worktrees, or a tree that has not installed yet

`core.hooksPath` is stored in the repository's shared `.git/config`, so every worktree of a clone gets it. The path is relative to each tree, which gives three cases:

- A tree that has not merged `main` yet has no `.githooks/` folder. Git then runs no hooks there, so it can still commit. Merge `main` to get the hooks.
- A tree with `.githooks/` but no `node_modules` stops the commit with `<package> is not installed. Run pnpm install at the repository root, then try again.` We chose a loud stop over a silent skip, so nobody commits unchecked work by accident. Run `pnpm install` in that tree.
- No Node on `PATH` stops the commit with a message that names this guide.

### Troubleshooting

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

**A new locale file is missing in the web tests** (`No translations for en/<name>`, or the raw key on screen). Vitest keeps transformed modules in `node_modules/.vitest-cache`, and `i18n.ts`'s list of locale files is from before the file existed. Delete that folder and run the tests again. CI starts clean, so it never sees this.

**The first `docker compose up` takes minutes.** It compiles MinIO from its source once. Later starts use the cached image.

**Start again from nothing.** `docker compose down` stops and removes the containers and keeps your data. Removing the data too (`docker compose down -v`) deletes the volumes: ask first, and know that it cannot be undone. After a change to the synthetic data, an old database keeps the rows of the old set, because the seed never overwrites a row that exists: start from a fresh database to see the new data.

## Workflow

The full version is in [the path from a story to main](AGENTS.md#the-path-from-a-story-to-main) and the [working agreement](docs/agile/working-agreement.md). In short:

1. **Pick a story that is ready.** The [Definition of Ready](docs/agile/definitions-of-ready-and-done.md#definition-of-ready) says what that means. Hold at most two at a time.
2. **Make one branch for one story,** from the latest `main`:

   ```sh
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c <branch>
   ```

   Use `feat/<area>-…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`. For example: `feat/area2-payment-gate`.

3. **Commit small, with [Conventional Commits](https://www.conventionalcommits.org/).** The types are `feat`, `fix`, `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `perf` and `build`. For example: `feat(api): add the health endpoints`.
4. **Bring the story's own pieces:** its models and migration, tests, `.env.example` entries and `.http` request files, an ADR if it made a decision, rows in the traceability matrix and `docs/architecture/patterns.md`, and one row in the [AI usage log](docs/ai/ai-usage-log.md). The matrix is [docs/requirements-traceability.md](docs/requirements-traceability.md) and the patterns file is [docs/architecture/patterns.md](docs/architecture/patterns.md).
5. **Open one pull request** from the [template](.github/PULL_REQUEST_TEMPLATE.md), with `Closes #N`. It covers:
   - what and why;
   - the acceptance criteria with evidence;
   - the real results of `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus `docker compose up --build` once it exists;
   - for UI changes, screenshots in light and dark from a Docker build of the branch, saved in `docs/design/screenshots/<area>/`.
6. **Get a review.** The reviewer of the day responds within one working day. Resolve every thread.
7. **Merge with a merge commit** once every required check is green. `Docker images` and `End-to-end smoke` show as skipped when a change touches none of their inputs, and that counts as green. The branch is then deleted and the story moves to Done.

### Never

- Never force push.
- Never commit straight to `main`.
- Never delete or overwrite someone else's work.
- Never add AI attribution or an em dash.
- Never commit real data, a key, a Spectra document or an AI tool folder.

If something destructive or irreversible seems necessary, ask Richie first.

## How to add a component

`apps/web` exists since P-11. The shadcn components it needs so far are in `apps/web/src/components/ui`.

1. **Look first.** The common components are in `apps/web/src/components/common`: import them from `@/components/common`. In demo mode and in development, `/gallery` shows each one with synthetic data. Which one do I use?

   | I need                                           | Use                                                                                                     |
   | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
   | A list with paging, sorting, search, export      | `DataTable`. The page owns the query and fetches; the table never sorts or slices                       |
   | The top of a page, or a titled block             | `PageHeader`, `SectionCard`                                                                             |
   | A page that is not built yet                     | `PlannedPage`                                                                                           |
   | Loading, empty, error, partial, denied           | `LoadingState`, `EmptyState` (give it a next action), `ErrorPanel`, `PartialNotice`, `PermissionDenied` |
   | A whole-route 403, 404 or crash                  | `StatePanel` (page variant), or the existing pages                                                      |
   | A demo or mock label                             | `DemoBadge` ("Mock", "Mock AI", "Synthetic demo data")                                                  |
   | A status, or how sensitive a record is           | `StatusBadge` (a tone plus your own label), `ClassificationBadge`                                       |
   | A value hidden by role                           | `MaskedValue` (pass no value when masked, and a reason)                                                 |
   | An AI value and its score                        | `ConfidenceBadge` (says "Requires approval" until a person approves)                                    |
   | A link to a record's audit trail                 | `AuditLink` (hides itself without `audit.read`)                                                         |
   | A time, a copyable id                            | `RelativeTime`, `CopyButton`                                                                            |
   | The change history under a detail page           | `OperationLog` (rows as props), or `EntityOperationLog` to fill it from the audit trail (F-2)           |
   | An amount, a list's main button, a message       | `Money`, `PageHeader`'s `primaryAction`, `toast.done` / `toast.failed`                                  |
   | A loading shape, or something to run from Ctrl+K | `ListPageSkeleton`, `TableSkeleton`, `PageHeaderSkeleton`, `SectionCardSkeleton`; `registerAction`      |

   **Lists, keys, actions and toasts.** Every screen gets these without extra work; use them the same way.

   - **Column kinds.** Give each `DataTable` column a `kind`: `"text"` (the default), `"number"`, `"money"` or `"date"`. Number and money columns sit on the right in tabular figures; every cell stays on one line, so rows are 36 to 40 px, unless the column says `wrap: true` (use it only for long text such as a summary). Show amounts with `<Money value="12340" />` from the decimal string, never a float: it prints `USD 12,340.00`. Dates go through `formatDay` from `@/lib/format` ("2 Nov 2026"). The heading stays at the top of the table's own scroll area, and the first column stays in view on a phone, so a table never makes the page scroll sideways.
   - **Primary action and keys.** A list declares its one primary action in its header: `<PageHeader title={t("title")} total={total} primaryAction={{ label: t("new"), icon: Upload, onRun: openUpload }} />`. It becomes the button on the right, shows a small `N` label, and the N key runs it. The common table's search box takes the `/` key by itself. Neither key fires while someone types in a field, holds Ctrl, Alt or Command, or has a dialog open. A page with no record to start passes no `primaryAction`. An empty list offers that action as its next step, so give `empty.action` only when the next step is something else.
   - **Loading and empty.** A page's loading shape matches its final layout: `PageHeaderSkeleton`, `SectionCardSkeleton` and the table's own placeholder rows (same columns, same row height). An empty list is a compact strip that names the next action: pass `action`, or `onRetry` to `EmptyState`, or words that say what to do. Never draw a large empty card.
   - **Ctrl+K actions.** A feature adds an action to the palette with one call in its `index.ts`: `registerAction({ id: "documents.upload", label: "palette.uploadPo", namespace: "documents", icon: Plus, keywords: ["purchase order", "new"], permission: "documents.upload", run: ({ navigate }) => navigate("/documents?upload=1") })`. `label` is an i18n key in `namespace` (default `common`). The palette lists the actions the session's permissions allow above the places to go. `actionsForRole(role)` reads the actions a role holds by default, for its quick actions on the home page.
   - **Toasts.** Every action ends with a toast: `toast.done(t("approved", { ref }), { undo })` when it worked, `toast.failed(t("notSaved"))` when it did not. Pass `undo` (a function that reverses the action) only where the action can really be undone; the toast then shows Undo, and undoing ends with its own "Undone" message. Words are yours, already translated. The `Toaster` in the shell shows and announces it; a toast never takes focus.

   Their text lives in the `components` namespace; your own goes in your area's namespace. If one is missing something, extend it there with a test. Do not copy it into your area. To show the operation log under a record, write its audit events with the record's type and id, then add `<EntityOperationLog entityType="Order" entityId={order.id} />` from `@/features/audit/EntityOperationLog` (steps in [area 4's guide](docs/team/area-4-controls-security-and-monitoring.md#how-another-area-feeds-the-operation-log)).

2. **Choose a free source.** Until P-22 sets up the Pro kits, use only:
   - shadcn/ui;
   - Magic UI (free);
   - React Bits (free, `@react-bits`);
   - ReUI's free components, only if they install without the licence key.

   Their licences need a private repository, which this is since 5 Nov 2026, and they need Richie's keys. P-22 sets them up; after that, adding a Pro component goes through Richie.

3. **Add it from `apps/web`,** with the shadcn CLI for a registry item, for example `npx shadcn@latest add tabs` (not `pnpm dlx`, which pnpm's trust policy refuses; see [ADR 0013](docs/adr/0013-the-web-stack.md)). The CLI writes the component into `src/components/ui` and imports `cn` from `cn`, a different package: change that import to `@/lib/utils` and remove the `cn` dependency it added. The component becomes code in this repository, so nobody needs a key to run or build it.
4. **Pin what it brings.** Registry items can declare caret ranges. Re-pin every new dependency to an exact version, and respect the 7-day release-age rule in `pnpm-workspace.yaml` ([ADR 0003](docs/adr/0003-pnpm-monorepo.md)).
5. **Make it ours:**
   - one component per file, under 200 lines;
   - a header comment stating its origin;
   - design tokens only, with no hard-coded colours or sizes;
   - Lucide icons only;
   - text through react-i18next, with no hard-coded strings (`i18n.test.ts` fails on a literal in JSX; the CLI's English "Close" or "Search" labels need `t()`).
6. **Cover every state and WCAG 2.2 AA.** Handle loading, empty, error with retry and a trace id, partial, success and permission denied, wherever they apply. See the [UI rules](CLAUDE.md#8-ui-rules).
7. **Test it** with Testing Library, and add its screenshots in light and dark to the pull request.
8. **Stay in your area.** Shared components need a review from their owners, listed in [module ownership](docs/team/module-ownership.md#shared-files-and-who-reviews-them).

## Building a form

Every form is built from the kit in `apps/web/src/components/form`, imported from `@/components/form`. Never hand-roll a field, a save or an error box. `/gallery` shows the whole kit on a sales order header with a faked save, in demo mode and in development.

```tsx
const form = useZodForm<OrderInput, Order>({
  schema: orderSchema,
  defaultValues: order,
});
const draft = useDraft(`order.${order.no}`, form, {
  exclude: ["lines.*.unitPrice"],
});
const save = useFormSave(form, {
  draft,
  onSave: (values) => updateOrder(order.no, values),
});
useSaveShortcut(form, save);

<FormShell form={form} draft={draft}>
  <FormGrid>
    <LookupField
      control={form.control}
      name="customer"
      label={t("customer")}
      search={searchCustomers}
      required
      className="sm:col-span-2"
    />
    <TextField
      control={form.control}
      name="customerPo"
      label={t("customerPo")}
      required
      code
    />
    <MoneyField
      control={form.control}
      name="freight"
      label={t("freight")}
      currency="USD"
    />
  </FormGrid>
  <FormActions>
    <SaveButton form={form} onSave={save} />
  </FormActions>
</FormShell>;
```

- **The schema** lives in `packages/shared` when the API checks the same thing, with plain messages ("Enter the customer's PO number", never "Too small"). A field shows its error when the person leaves it, then on each change.
- **Fields:** `TextField`, `NumberField` (with a `unit`), `MoneyField` (a decimal string with its currency, never a float), `DateField` (YYYY-MM-DD), `SelectField`, `TextAreaField`, `CheckboxField` and `LookupField`. Each takes `label`, `hint`, `required`, `disabled` and `readOnly`, and wires its label, hint, error, `aria-describedby` and `aria-invalid` itself. Prefer `readOnly` to `disabled`: it stays focusable and copyable. Amounts are tidied when the field is left after typing, never when it is only tabbed through, and a comma counts only as grouping ("1,200.50"): "12,50" is left for the schema to refuse. In a table cell, pass `hideLabel`: the label is not drawn but stays the field's accessible name. On a touch screen every control grows to 44 px.
- **A rule across fields** (a ship-by date after the order date) sits on a small object of just those fields, joined to the main schema with `.and()`: on the whole object it would wait until every other field was right. A field that shows an error is checked again whenever any other field changes, so the error clears when the other field is corrected.
- **A lookup** takes a `search(query, signal)` that returns `{ number, name, detail? }` records and stops when `signal` aborts. It holds `{ number, name }` or null; send the number. Use `requiredLookup(message)` in the schema. Its keys are those of Microsoft Dynamics 365 Business Central: type a number and press Enter or Tab and the record is picked once the search has answered; the arrows only ever move through the results of the text as it stands. `onPick(option)` gives the page the whole record, for a unit price or the stock on hand. The list is a popover, so a grid cell cannot clip it.
- **Errors: one line.** Save through `useFormSave` and every error lands for you: each `details` entry on its field in the server's words (`lines.0.quantity` included), the highest one focused, and the rest, a 409, a 403 or a 500, at the top with the trace id. A rule the schema refuses where no field shows it (a list that needs a line) goes to the same place, so Save never seems to do nothing. A path under a lookup (`customer.number`) lands on the lookup. Where the API's names differ from the form's, pass `serverPaths`: `{ customerNo: "customer", "lines.*.itemNo": "lines.*.item" }`. Outside `useFormSave`, call `applyServerError(error, form, map)` in your `catch`.
- **Drafts.** `useDraft(key, form, { exclude, rowKey })` keeps unsaved changes in this browser for this viewer and this record. Put the record's number in the key, and list every field that can be masked in `exclude`, with `*` for every row. A row's left-out fields come back only from the row with the same `rowKey` field (`id` by default), never by position, so give rows a stable id; a row with none comes back with those fields empty. Mount the form once its record has loaded. A draft goes on save, on Discard and on sign-out, and stays when the session expires. Drafts older than seven days are dropped, whoever's they are. After a save the form is clean again, but anything typed while it ran stays unsaved. Signing out removes drafts only for the tab where it happens: another tab left open can write one again, since tabs share no session signal yet.
- **Leaving and keys.** `FormShell` asks before a route change or a tab close while the form has unsaved changes; pass `leaveGuard={false}` for a form that keeps nothing, such as a filter. Signing out over a form with changes asks too, and says they will be deleted. The prompt opens on Keep editing, and focus returns to the field. Enter never submits. Ctrl+S or Command+S saves through `useSaveShortcut`, from inside a field too. Save is refused until something has changed: pass `allowClean` for a form that its defaults fill in, such as an SPR raised from a shortage line, and `blockedReason` when the person cannot save yet, in their words. **Pass the same two options to `SaveButton` and to `useSaveShortcut`**, and the button and the key always agree.

## Building a list

Every list is a `ListPage` from `@/components/list-page`. Never hand-roll a toolbar, a filter select or a table around `DataTable`. `/gallery` shows one with its filters, actions, reason dialog, Export and Print.

```tsx
const [query, setQuery] = useUrlQuery(URL_FILTERS, { pageSize: 25 });
const params = apiParams(query, SORTABLE);
const list = useMasterDataItems(params, {
  query: { placeholderData: (previous) => previous },
});

<ListPage
  tableId="master-data-items"
  title={t("items.title")}
  caption={t("items.caption")}
  columns={columns}
  rowKey={(row) => row.no}
  rowHref={(row) => `/master-data/items/${row.no}`}
  query={query}
  onQueryChange={setQuery}
  list={list}
  filters={filters}
  actions={actions}
  exportOptions={{ fileName: "items", loadRows }}
/>;
```

- **The address.** `useUrlQuery(spec)` keeps search, filters, page, sort and page size in the URL and reads them back on a reload. `spec` is a constant: each filter with the values it allows, or `null` for any text (or a plain list of names). A value the API would refuse falls back to the default. `apiParams` turns the query into the call's parameters, and `allPages` fetches every page for an export.
- **Filters** are declared: `{ id, label, kind, allLabel, options, more }`. Keep the three or four that matter in the bar and mark the rest `more: true`. A `kind: "toggle"` is a yes/no switch, `"lookup"` is a select with a search box for a long list (the value is the Business Central number), and `"range"` is two dates kept as `idFrom` and `idTo`: spread `rangeSpec(id)` into the spec. Every filter id must be in the `useUrlQuery` spec; development throws if one is missing. Applied filters show as chips with Clear all. Give options plain labels, never raw codes.
- **Actions** are declared too: `{ id, kind, label, icon, permission, needs, onRun }`. The kinds are `new`, `edit`, `void`, `disable`, `batch`, `import`, `export` and `print`, and the bar always draws them in that order. An action is drawn only if the role holds its `permission`, so a screen never shows a button the role cannot use (the server still refuses it). `new` is the one primary button and the N key runs it. The kinds also include `view` and `copy`, which only a row menu offers. An action that needs a selection is blocked with its reason until a row is ticked: the template draws the checkboxes, the count and Clear selection itself, and runs a batch action on the ticked rows. `enabledFor(rows)` returns a reason when the selected rows cannot take it (only SPRs waiting for approval can be approved), so the rule is declared, not hidden in `onRun`. Export and Print are done for you from `exportOptions`.
- **Void and Disable** take `reasoned: { title, confirmLabel, doneMessage, run }`. The template asks for a required reason in one dialog, shows the server's words under the field, and ends with a toast.
- **A status** on a list is `<StatusChip family="waiting">{t("...")}</StatusChip>`. The family is draft, waiting, ready, blocked or done (or none, for neutral); the word is yours. Never list status codes in the web app.
- **The grid.** Checkboxes appear when an action needs rows or the screen asks for the operation log. The row menu (View, Edit, Copy, Void or Disable) shows the actions the screen declares and the role may use, for that row only. A feature adds an item to every list's row menu once with `registerRowMenuItem` (My work does this in P-57). Saved views keep the search, filters, sort and columns for each person in their browser, and Columns shows, hides and orders them.
- **Print and the log.** Print streams a long list into a frame of its own a page at a time, so declare `loadPage={(page) => call({ ...params, page, pageSize: 200 })}` for a list that can be long. `operationLog={{ entityType, entityId }}` draws the ticked record's log at the foot: who, when and what, never a value or an IP address ([ADR 0043](docs/adr/0043-the-list-grid-saved-views-and-a-record-scoped-log.md)). The kinds of record are `OPERATION_LOG_READERS` in `packages/shared`.

## Building a lines grid

Order and SPR lines are typed into the lines grid in `apps/web/src/components/lines-grid`, imported from `@/components/lines-grid`. It sits inside a `FormShell` whose form has a `lines` array of `LineValue`. `/gallery` shows it as Support uses it, with prices masked, read-only and with 200 lines.

```tsx
const columns: LineColumn[] = [
  { kind: "lineNo", header: t("line") },
  { kind: "item", header: t("item") },
  { kind: "description", header: t("description"), readOnly: true },
  { kind: "quantity", header: t("quantity") },
  { kind: "unitPrice", header: t("unitPrice") },
  { kind: "amount", header: t("amount") },
  { kind: "availability", header: t("availability") },
  { kind: "remove", header: t("remove") },
]; // An SPR lists only lineNo, item, quantity, availability and remove.

const draft = useDraft(
  `order.${no}`,
  form,
  lineDraftOptions("lines", priceMask !== null),
);

<LinesGrid
  label={t("orderLines")}
  columns={columns}
  searchItems={searchItems} // (query, signal) => Promise<ItemOption[]>
  priceMask={priceMask} // { reason, visibleTo } for a role that may not see prices
  serverTotals={saved?.totals}
  shortfallAction={(short) => <RaiseSprButton line={short} />}
/>;
```

- **A line** is `{ lineId, item, description, quantity, unitPrice, unit, availableStock }`. Make a new one with `emptyLine()`, and give a saved line its own `lineId`. Quantity and price are decimal strings, never numbers. The schema is the screen's, in `packages/shared` when the API checks the same thing; `requiredLookup` refuses a line whose item was not chosen from the list.
- **The item search** returns `{ number, name, detail, description, unit, availableStock, unitPrice }` for each item, where `number` is the Business Central number and `detail` is the part number. `availableStock` is what the API reports from the same formula as master data: never work it out in the web app. `unitPrice` is the API's masked field. Picking an item fills the description, the unit, the stock and, if the role may see prices, the default price. A grid can change what the pick fills: see the next line.
- **What picking an item fills.** `itemDescription` is `"copy"` by default: the pick writes the item's own words into the description. `"own"` leaves the description empty, with the hint "If different", for a person's own wording only. The order form uses it, and the server stores the item's own description for a line sent without one, so a saved line opened again shows the description the order holds. `itemPrice` is `"fill"` by default and `"reference"` leaves the price empty for the document's own price (an order's PO), with the last agreed price beside it as context.
- **Keys.** Tab and Shift+Tab walk the cells. Enter moves to the next cell, and on the last one adds a line and lands in its item cell. After an item is picked by Enter, focus goes to the quantity. Esc leaves a cell for its line, where Delete removes it and the arrows change line. Ctrl+Delete removes the line from inside a field, and Alt with the up or down arrow changes line from inside one. Delete and the arrows in a field are the field's own. Removing a line ends with a toast whose Undo puts it back.
- **Amounts and totals** are worked out from the strings with `lineAmount` and `sumDecimal` from `@orderpilot/shared`, as you type. `useLineTotals` gives a footer of your own the one value it needs; the default footer is `LinesFooter`. After a save pass the server's totals as `serverTotals`: they are shown until a line changes, and the server's answer wins.
- **Masks.** Pass `priceMask` for a role that may not see prices. The price and amount cells and the total show the mask and its reason, no price is written to the form, and `lineDraftOptions` leaves prices out of the draft. The API sends no price to that role.
- **Errors.** Save through `useFormSave` with `serverPaths` such as `{ "lines.*.itemNo": "lines.*.item" }`. An error on `lines.2.quantity` lands on that cell and takes the focus, and the line's number is marked.
- **A shortfall** is flagged in words on the line: what is needed, what is available and how short it is. `shortfallAction` is the slot for Raise SPR. It never stops a save.
- Pass `readOnly` to draw a saved record: plain text cells, no buttons.

## Building a document form

Orders, SPRs, payment confirmations and shipments are edited on the document form in `apps/web/src/components/document-form`, imported from `@/components/document-form` ([ADR 0045](docs/adr/0045-a-document-form-is-declared-and-the-template-draws-it.md)). A screen declares; the template draws the title, the action bar, the header, the lines, the footer and the tabs. `/gallery` shows a sales order with a fake server.

```tsx
const form = useZodForm({ schema, defaultValues });

<DocumentForm
  formId="sales-order"
  form={form}
  title={t("title", { number })}
  number={number}
  formLabel={t("formLabel")}
  header={<OrderHeaderFields form={form} />} // a FormGrid of kit fields
  lines={
    <LinesGrid label={t("lines")} columns={columns} searchItems={search} />
  }
  status={{ family: "waiting", label: t("status.waiting") }}
  attachments={attachments}
  totals={[{ id: "total", label: t("total"), value: <Money value={total} /> }]}
  actions={[
    { id: "save", kind: "save", permission: "orders.read" },
    {
      id: "submit",
      kind: "submit",
      permission: "orders.read",
      blocked,
      run: submit,
    },
    {
      id: "void",
      kind: "void",
      permission: "orders.read",
      reasoned: { title, confirmLabel, doneMessage, run },
    },
  ]}
  draftKey={`order.${number}`}
  allowClean={false}
  saveBlocked={closed ? t("closed") : undefined} // "A voided order cannot be changed."
  onSave={(values, andNew) => save(values, andNew)}
  nextValues={() => blankOrder()} // what Save and new opens: blank fields
  onSaved={(saved, andNew) => (andNew ? startNext() : undefined)}
  print={() => ({ title, fields, lines, totals })}
  tabs={{
    timeline,
    checks,
    documents,
    log: { entityType: "Order", entityId: number },
  }}
/>;
```

- **Actions.** Declare each with its `kind` (`save`, `saveNew`, `submit`, `approve`, `reject`, `print`, `void`) and the permission that uses it. The template draws only those the role holds, in a fixed order, and never changes a status: Submit, Approve and Reject call your `run`, and the status lives in area 2's state machine. Give `blocked` (already worded) when the document cannot take the action now. Void and Reject take a `reasoned` block and the template asks for the reason.
- **Saving.** `onSave` receives the checked values and whether Save and new was pressed. A throw lands on the fields through `serverPaths`, as in "Building a form". Submit, Approve, Reject, Void and Print wait, with "Save your changes first", while the form has unsaved changes. While one action runs, every other action and both saves wait with "Working". A failure shows the server's words and its trace id in a toast, and a throw in `onSaved` is shown the same way. Pass `saveBlocked` for a closed document (void, approved), and the header and lines read-only. A click on a blocked button shows its reason as text beside the bar. Pass `allowClean` for a document filled in by its defaults. After Save and new the template resets the form to what `nextValues()` returns (the next document's blank values, with a fresh number) and clears the draft, then calls `onSaved`; without `nextValues` the saved values stay.
- **Drafts.** The template keeps the draft under `draftKey`. Pass `draftOptions.exclude` for masked fields. While the record is not in hand, pass `state` (`loading`, `error` with the error and `onRetry`, `denied` or `notFound`): the template draws it under the title, from the same pieces as the lists, and mounts the form, and so restores a draft, only once `state` is gone.
- **Notices.** Pass `notices` (any node) to draw something between the action bar and the header: P-61 puts the approval route there, and P-62 the payment hold.
- **What a role may not see.** A figure a role may not see is a `MaskedValue`, which carries its reason. An attachment a role may not open is left out of `attachments`, and the API refuses the download too. The template draws what it is given, and links only relative and http(s) addresses.
- **Tabs.** Timeline, Checks and Documents take `{ count, content }`; `count` is what needs attention, and `content: null` draws the empty line. The operation log tab needs `log`, and is not drawn for a role that may not read that record.
- **Permissions.** The matrix is area 4's. The order form (P-49) names `orders.create` and `orders.edit`, held by Support and the Product Manager and never by the System admin. The other write permissions are not in `packages/shared` yet, so the gallery borrows `orders.read` for Save, Submit, Print and Void, and every role that reads orders sees them there; Approve and Reject use `approvals.decide`, which shows the role rule. A real form names the permission its story adds (P-50, P-61, P-62, P-63).
- **Print or PDF.** Give `print` a function that returns the document as text; the template adds the status first. It opens the browser's print view, where "Save as PDF" is the PDF, until generated documents arrive (B-3).
- **Shared actions.** `registerDocumentFormItem({ id, label, icon, permission, appliesTo, run })` adds an action to every form's More menu. `appliesTo(target)` limits it to the documents it fits, and a throw or rejection in `run` is shown as a failure. Registering an id twice warns in development. P-57 uses it for My work.

## Adding an API route

The web app never hand-writes a call to the API. It uses hooks and mock handlers that orval generates from the API's OpenAPI file ([ADR 0019](docs/adr/0019-generated-api-hooks-and-mocks.md)).

1. Add the route in `apps/api` with its zod schemas from `packages/shared`: `@ApiOkResponse({ schema: openApiSchema(responseSchema) })` for the answer, `@openApiQuery(querySchema)` for query parameters.
2. **Say who may call it.** Every route is refused until it says one of three things ([ADR 0012](docs/adr/0012-sessions-and-rbac.md)); a route that says nothing is refused (401 without a session, 403 with one):

   ```ts
   @Get(":id")
   @RequirePermission("orders.read") // a signed-in user whose role holds it
   get(@Param(idParam) params: { id: string }, @Auth() auth: AuthContext) {}
   // @Authenticated()  any signed-in user      @Public()  no session at all
   ```

   The permission name comes from `packages/shared` (`PERMISSIONS`); a new one is added there and to `DEFAULT_ROLE_PERMISSIONS`, and area 4 edits the live matrix. The CSRF check, the 401 and 403 answers and their audit events come with the decorator: write nothing else. Test the 401 and the 403 (copy `apps/api/test/http/auth-guards.test.ts`).

3. Run `pnpm api:generate`. It rewrites `apps/api/openapi.json` and `apps/web/src/lib/api/generated/`.
4. Commit the result with the route. CI runs `pnpm api:check` and fails if the generated files are out of date.
5. In the web app, import the hook (`useSystemChecks`) from `@/lib/api/generated/endpoints/<tag>/<tag>`. In a test, add the generated handler with `server.use(getSystemChecksMockHandler(...))` from `@/test/server`. `useServiceHealth` and `HealthPanel.test.tsx` (the system health section of the settings page) are the example.

Never edit the generated folder by hand.

## End-to-end tests

Every CRUD screen brings `apps/e2e/tests/<screen>.spec.ts` ([prompt 004](docs/ai/prompts/004-erp-grade-workspace.md#8-check-it), section 8): an allowed role creates, edits and voids a record, and a role without the permission sees no button and gets a 403 from the server. [`governance.spec.ts`](apps/e2e/tests/governance.spec.ts) is the shortest example, and [`smoke.spec.ts`](apps/e2e/tests/smoke.spec.ts) the longest.

Import everything from `../src/index.js`, never from `@playwright/test`: its `test` watches every page and answers the analytics card.

| Helper                                      | What it does                                                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signInAs(page, role)`                      | A real session as that role's demo persona, signed in once per run and reused. `{ fresh: true }` signs in anew, for a test that signs out                                        |
| `checkPage(page)`                           | Fails on console errors, CSP violations, 5xx answers, a 403 from the API, "Planned" and other developer text, sideways scroll at 1440 and 390 wide, and axe WCAG 2.2 AA problems |
| `expectNoButton(page, name)`                | No button with that accessible name, once the page has loaded                                                                                                                    |
| `expectRefused(role, method, route, body?)` | Calls the API directly as that role, with its CSRF token, and expects a 403 `FORBIDDEN` envelope whose trace id is the request's                                                 |

```ts
import {
  checkPage,
  expect,
  expectNoButton,
  expectRefused,
  signInAs,
  test,
} from "../src/index.js";

test("support creates, edits and voids an order", async ({ page }) => {
  await signInAs(page, "SUPPORT");
  await page.goto("/orders");
  await checkPage(page);
  await page.getByRole("button", { name: "New order" }).click();
  // ...fill the form, save, edit, then void with a reason, checking each step.
});

test("the warehouse sees no New order button and is refused", async ({
  page,
}) => {
  await signInAs(page, "WAREHOUSE");
  await page.goto("/orders");
  await expectNoButton(page, "New order");
  await expectRefused("WAREHOUSE", "POST", "/orders", validOrderBody);
});
```

- Send `expectRefused` a body the route would accept, so the 403 cannot be a validation error.
- Show in the same spec that the allowed role does see the button, or a misspelt name passes `expectNoButton` for the wrong reason.
- Give each record a value of its own (a PO number with the test's name in it, say), because the tests run in parallel against one database and are run again.
- A new page that every role should open goes in `SMOKE_PAGES` (`apps/e2e/src/roles.ts`) and is then in the smoke test too.

## Using AI tools

- Paste the [starter prompt](AGENTS.md#starter-prompt) at the start of each session.
- Add one row to the [AI usage log](docs/ai/ai-usage-log.md) for each story, and keep your prompts in `docs/ai/prompts/` as `areaN-NNN-…`.
- You must be able to explain every line you merge. Each member explains their own code at the Week 7 interview.

## Reporting a security problem

Don't open a public issue. Follow [SECURITY.md](SECURITY.md).
