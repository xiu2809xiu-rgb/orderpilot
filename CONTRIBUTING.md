# Contributing to OrderPilot

Everyone on the team follows this guide, whichever tools they use. [CLAUDE.md](CLAUDE.md) holds the product brief and the standards. If you use an AI tool, it must follow [AGENTS.md](AGENTS.md).

## Set-up

Set-up is short. Each story adds its own steps here when it merges. These steps work on Windows (in Git Bash or PowerShell) and on macOS.

### What works today

1. Install Git, Node 24.22.0 (the version in [`.node-version`](.node-version)) and pnpm 12:

   ```sh
   npm install -g pnpm@12.14.0
   ```

   On macOS, `corepack enable` works too. On Windows it needs an administrator prompt, so use the line above.

2. Clone the repository:

   ```sh
   git clone https://github.com/xiu2809xiu-rgb/orderpilot.git
   cd orderpilot
   ```

3. Commit with your GitHub no-reply email, never a school email. You will find it on GitHub under Settings, Emails. On that page, also turn on **Keep my email addresses private**: GitHub writes merge commits itself, so the local setting below does not reach them. Then set the address for this repository:

   ```sh
   git config user.email "<your GitHub no-reply address>"
   ```

4. Install the workspace. This also installs the Git hooks:

   ```sh
   pnpm install
   ```

   It prints `Git hooks installed: core.hooksPath is .githooks.` If you installed before the hooks existed, pnpm skips that step when nothing else changed, so run `pnpm run prepare` once.

5. Check that everything passes:

   ```sh
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

6. Read [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) and the [working agreement](docs/agile/working-agreement.md).

Line endings need no set-up. [`.gitattributes`](.gitattributes) keeps text files LF on every machine, even with `core.autocrlf` on.

### Running the API

The API needs one setting before it starts, so copy the example file. One `.env` at the repository root is enough:

```sh
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
pnpm build                  # once: the API runs against the built @orderpilot/shared
pnpm --filter @orderpilot/api dev
```

`pnpm dev` rebuilds and restarts when you save a file. To run the built output instead, use `pnpm --filter @orderpilot/api start`.

Then try:

- <http://localhost:3000/health> and <http://localhost:3000/health/ready>;
- <http://localhost:3000/api/docs>, the Swagger page for "OrderPilot API";
- the `.http` files in [`apps/api/requests`](apps/api/requests), in VS Code (REST Client) or a JetBrains IDE.

The API reads `apps/api/.env`, then the root `.env`, and never overrides a variable your shell, CI or Docker already set. If something required is missing, it stops and names the file to create. To change the port for one run: `API_PORT=3100 pnpm --filter @orderpilot/api dev` (PowerShell: `$env:API_PORT=3100` first). The layers and patterns are in [docs/architecture](docs/architecture/README.md). There is no database yet: PostgreSQL, Redis and MinIO arrive with P-9.

### Run the web app

The web app is `apps/web` (`@orderpilot/web`). It needs no database, but its pages need the API for a real sign-in, which arrives with P-10.

```sh
pnpm --filter @orderpilot/web dev        # http://localhost:5173, with /api proxied to the API
pnpm --filter @orderpilot/web build      # type-check, then a production build in apps/web/dist
pnpm --filter @orderpilot/web preview    # serve that build with the production security headers
pnpm budget                              # initial JS must be 250 KB gzip or less (run after a build)
pnpm --filter @orderpilot/web test       # component and unit tests
```

- **Ports:** `WEB_PORT` (default 5173) and `API_PORT` (default 3000) are in [`.env.example`](.env.example). Vite reads only those two names from the root `.env`.
- **Demo sign-in:** with the API's demo mode on, the login page lists the nine roles. Without the API running, the page loads but cannot sign in.
- **Where things are:** each area's screens go in `apps/web/src/features/<feature>/`; the shell, router and guards are in `src/app/`; text is in `src/locales/en/`. [ADR 0013](docs/adr/0013-the-web-stack.md) explains the layout.
- **Screenshots** for a pull request come from `apps/web/scripts/screenshots.mjs`, which needs Playwright installed outside the repository (the top of the file says how) until P-14 adds it.

There is no Docker image of the web app until P-13.

### The root scripts

| Command                  | What it does                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| `pnpm lint`              | ESLint over the whole repository, failing on any warning                          |
| `pnpm typecheck`         | TypeScript over the scripts, then each package's own `typecheck`                  |
| `pnpm test`              | The repository's `node --test` tests, then each package's own `test`              |
| `pnpm build`             | Each package's own `build`                                                        |
| `pnpm format`            | Prettier writes every file. Mass formatting: ask first (AGENTS.md, rule 4)        |
| `pnpm format:check`      | Prettier checks every file and writes nothing                                     |
| `pnpm check:dashes`      | No em dash in any tracked text file                                               |
| `pnpm check:samples`     | No client sample in any tracked file; `check:samples:history` checks every commit |
| `pnpm check:licence-key` | No licence key value and no env file in any tracked file                          |
| `pnpm check:secrets`     | secretlint over the whole working tree                                            |

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

### What later stories bring

| Step                                                              | Story |
| ----------------------------------------------------------------- | ----- |
| PostgreSQL, Redis and MinIO in Docker, with the ports from `.env` | P-9   |
| The full stack with `docker compose up --build`                   | P-13  |
| End-to-end tests with Playwright and axe                          | P-14  |
| The troubleshooting guide: ports in use, PostgreSQL and Docker    | P-9   |

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

1. **Look first.** P-12 brings the common components: the data table, every page state, badges, masked values and more. Use those before you add anything.
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
2. Run `pnpm api:generate`. It rewrites `apps/api/openapi.json` and `apps/web/src/lib/api/generated/`.
3. Commit the result with the route. CI runs `pnpm api:check` and fails if the generated files are out of date.
4. In the web app, import the hook (`useSystemChecks`) from `@/lib/api/generated/endpoints/<tag>/<tag>`. In a test, add the generated handler with `server.use(getSystemChecksMockHandler(...))` from `@/test/server`. `ServiceChecksCard` and its test are the example.

Never edit the generated folder by hand.

## Using AI tools

- Paste the [starter prompt](AGENTS.md#starter-prompt) at the start of each session.
- Add one row to the [AI usage log](docs/ai/ai-usage-log.md) for each story, and keep your prompts in `docs/ai/prompts/` as `areaN-NNN-…`.
- You must be able to explain every line you merge. Each member explains their own code at the Week 7 interview.

## Reporting a security problem

Don't open a public issue. Follow [SECURITY.md](SECURITY.md).
