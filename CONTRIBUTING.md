# Contributing to OrderPilot

Everyone on the team follows this guide, whichever tools they use. [CLAUDE.md](CLAUDE.md) holds the product brief and the standards. If you use an AI tool, it must follow [AGENTS.md](AGENTS.md).

## Set-up

There is no app yet, so set-up is short. Each later story adds its own steps here when it merges.

### What works today

1. Install Git and Node 24.22.0, the version in [`.node-version`](.node-version).
2. Clone the repository:

   ```sh
   git clone https://github.com/xiu2809xiu-rgb/orderpilot.git
   cd orderpilot
   ```

3. Commit with your GitHub no-reply email, never a school email. You will find it on GitHub under Settings, Emails. On that page, also turn on **Keep my email addresses private**: GitHub writes merge commits itself, so the local setting below does not reach them. Then set the address for this repository:

   ```sh
   git config user.email "<your GitHub no-reply address>"
   ```

4. Read [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md) and the [working agreement](docs/agile/working-agreement.md).

Line endings need no set-up. [`.gitattributes`](.gitattributes) keeps text files LF on every machine, even with `core.autocrlf` on.

There is nothing to install, build, test or start yet.

### What later stories bring

| Step                                                                     | Story |
| ------------------------------------------------------------------------ | ----- |
| `pnpm install`, and the root scripts for lint, typecheck, test and build | P-5   |
| The Git hooks, installed with the workspace                              | P-5   |
| `cp .env.example .env`, then PostgreSQL, Redis and MinIO in Docker       | P-9   |
| The full stack with `docker compose up --build`                          | P-13  |
| End-to-end tests with Playwright and axe                                 | P-14  |
| The troubleshooting guide: ports in use, PostgreSQL and Docker           | P-9   |

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
4. **Bring the story's own pieces:** its models and migration, tests, `.env.example` entries and `.http` request files, an ADR if it made a decision, rows in the traceability matrix and `docs/architecture/patterns.md`, and one row in the [AI usage log](docs/ai/ai-usage-log.md). The matrix arrives in P-3 and the patterns file in P-8.
5. **Open one pull request** from the [template](.github/PULL_REQUEST_TEMPLATE.md), with `Closes #N`. It covers:
   - what and why;
   - the acceptance criteria with evidence;
   - the real results of `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus `docker compose up --build` once it exists. Before P-5 no `pnpm` command exists, so say that instead;
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

This applies from P-11, when `apps/web` exists. Before that there is nowhere to add one.

1. **Look first.** P-12 brings the common components: the data table, every page state, badges, masked values and more. Use those before you add anything.
2. **Choose a free source.** While the repository is public, use only:
   - shadcn/ui;
   - Magic UI (free);
   - React Bits (free, `@react-bits`);
   - ReUI's free components, only if they install without the licence key.

   No React Bits Pro or ReUI Pro code goes into a public repository, because their licences need a private one. Once it is private, adding a Pro component goes through Richie.

3. **Add it from `apps/web`,** with the shadcn CLI for a registry item. P-11 records the exact command. The component becomes code in this repository, so nobody needs a key to run or build it.
4. **Pin what it brings.** Registry items can declare caret ranges. Re-pin every new dependency to an exact version, and respect the release-age rule that P-5 sets.
5. **Make it ours:**
   - one component per file, under 200 lines;
   - a header comment stating its origin;
   - design tokens only, with no hard-coded colours or sizes;
   - Lucide icons only;
   - text through react-i18next, with no hard-coded strings.
6. **Cover every state and WCAG 2.2 AA.** Handle loading, empty, error with retry and a trace id, partial, success and permission denied, wherever they apply. See the [UI rules](CLAUDE.md#8-ui-rules).
7. **Test it** with Testing Library, and add its screenshots in light and dark to the pull request.
8. **Stay in your area.** Shared components need a review from their owners, listed in [module ownership](docs/team/module-ownership.md#shared-files-and-who-reviews-them).

## Using AI tools

- Paste the [starter prompt](AGENTS.md#starter-prompt) at the start of each session.
- Add one row to the [AI usage log](docs/ai/ai-usage-log.md) for each story, and keep your prompts in `docs/ai/prompts/` as `areaN-NNN-…`.
- You must be able to explain every line you merge. Each member explains their own code at the Week 7 interview.

## Reporting a security problem

Don't open a public issue. Follow [SECURITY.md](SECURITY.md).
