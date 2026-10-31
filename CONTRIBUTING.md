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

- **Who reads it.** The API reads `apps/api/.env` first, then the root `.env`. The Prisma commands (`pnpm db:migrate` and the others) read the same files by the same rules. Docker Compose reads the root `.env` itself for the ports and passwords. The web app's Vite server reads only `API_PORT` and `WEB_PORT` from it. `pnpm local:setup` never reads it.
- **The shell wins.** A variable already set in your shell, in CI or by Docker is never overridden by a file. A file that is missing is skipped.
- **References.** A value may use another, such as `${POSTGRES_PORT}`, so one line moves every URL built from it.
- **Missing values.** If something required is missing, the API stops and names the file to create.

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
- **Screenshots** for a pull request come from `apps/web/scripts/screenshots.mjs`, which needs Playwright installed outside the repository (the top of the file says how) until P-14 adds it.

There is no Docker image of the web app until P-13.

### The root scripts

| Command                  | What it does                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`              | ESLint over the whole repository, failing on any warning                                                                      |
| `pnpm typecheck`         | TypeScript over the scripts, then each package's own `typecheck`                                                              |
| `pnpm test`              | The repository's `node --test` tests, then each package's own `test`. The API's integration tests need the stack up           |
| `pnpm build`             | Each package's own `build`                                                                                                    |
| `pnpm format`            | Prettier writes every file. Mass formatting: ask first (AGENTS.md, rule 4)                                                    |
| `pnpm format:check`      | Prettier checks every file and writes nothing                                                                                 |
| `pnpm check:dashes`      | No em dash in any tracked text file                                                                                           |
| `pnpm check:samples`     | No client sample in any tracked file; `check:samples:history` checks every commit                                             |
| `pnpm check:licence-key` | No licence key value and no env file in any tracked file                                                                      |
| `pnpm check:secrets`     | secretlint over the whole working tree                                                                                        |
| `pnpm local:setup`       | The whole set-up, safe to repeat after a pull: `.env` if missing, the stack, Prisma client, migrations, shared packages, seed |
| `pnpm dev`               | The API and the web app together, restarting the API when you save a file                                                     |
| `pnpm stack:up`          | `docker compose up -d --wait`: PostgreSQL, Redis, MinIO and Mailpit, healthy before it returns                                |
| `pnpm stack:down`        | `docker compose down`: stops and removes the containers, keeps the data                                                       |
| `pnpm db:migrate`        | Applies pending migrations to the development database                                                                        |
| `pnpm db:migrate:dev`    | Creates a migration after you edit a `.prisma` file                                                                           |
| `pnpm db:generate`       | Rebuilds the Prisma client (`pnpm install` does it too)                                                                       |
| `pnpm db:seed`           | Seeds the development database; safe to run again                                                                             |

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

**The first `docker compose up` takes minutes.** It compiles MinIO from its source once. Later starts use the cached image.

**Start again from nothing.** `docker compose down` stops and removes the containers and keeps your data. Removing the data too (`docker compose down -v`) deletes the volumes: ask first, and know that it cannot be undone.

### What later stories bring

| Step                                            | Story |
| ----------------------------------------------- | ----- |
| The full stack with `docker compose up --build` | P-13  |
| End-to-end tests with Playwright and axe        | P-14  |

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
7. **Merge with a merge commit** once every required check is green. The branch is then deleted and the story moves to Done.

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

   | I need                                      | Use                                                                                                     |
   | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
   | A list with paging, sorting, search, export | `DataTable`. The page owns the query and fetches; the table never sorts or slices                       |
   | The top of a page, or a titled block        | `PageHeader`, `SectionCard`                                                                             |
   | A page that is not built yet                | `PlannedPage`                                                                                           |
   | Loading, empty, error, partial, denied      | `LoadingState`, `EmptyState` (give it a next action), `ErrorPanel`, `PartialNotice`, `PermissionDenied` |
   | A whole-route 403, 404 or crash             | `StatePanel` (page variant), or the existing pages                                                      |
   | A demo or mock label                        | `DemoBadge` ("Mock", "Mock AI", "Synthetic demo data")                                                  |
   | A status, or how sensitive a record is      | `StatusBadge` (a tone plus your own label), `ClassificationBadge`                                       |
   | A value hidden by role                      | `MaskedValue` (pass no value when masked, and a reason)                                                 |
   | An AI value and its score                   | `ConfidenceBadge` (says "Requires approval" until a person approves)                                    |
   | A link to a record's audit trail            | `AuditLink` (hides itself without `audit.read`)                                                         |
   | A time, a copyable id                       | `RelativeTime`, `CopyButton`                                                                            |
   | The change history under a detail page      | `OperationLog` (rows as props), or `EntityOperationLog` to fill it from the audit trail (F-2)           |

   Their text lives in the `components` namespace; your own goes in your area's namespace. If one is missing something, extend it there with a test. Do not copy it into your area. To show the operation log under a record, write its audit events with the record's type and id, then add `<EntityOperationLog entityType="Order" entityId={order.id} />` from `@/features/audit/EntityOperationLog` (steps in [area 4's guide](docs/team/area-4-controls-security-and-monitoring.md#how-another-area-feeds-the-operation-log)).

2. **Choose a free source.** While the repository is public, use only:
   - shadcn/ui;
   - Magic UI (free);
   - React Bits (free, `@react-bits`);
   - ReUI's free components, only if they install without the licence key.

   No React Bits Pro or ReUI Pro code goes into a public repository, because their licences need a private one. Once it is private, adding a Pro component goes through Richie.

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
5. In the web app, import the hook (`useSystemChecks`) from `@/lib/api/generated/endpoints/<tag>/<tag>`. In a test, add the generated handler with `server.use(getSystemChecksMockHandler(...))` from `@/test/server`. `ServiceChecksCard` and its test are the example.

Never edit the generated folder by hand.

## Using AI tools

- Paste the [starter prompt](AGENTS.md#starter-prompt) at the start of each session.
- Add one row to the [AI usage log](docs/ai/ai-usage-log.md) for each story, and keep your prompts in `docs/ai/prompts/` as `areaN-NNN-…`.
- You must be able to explain every line you merge. Each member explains their own code at the Week 7 interview.

## Reporting a security problem

Don't open a public issue. Follow [SECURITY.md](SECURITY.md).
