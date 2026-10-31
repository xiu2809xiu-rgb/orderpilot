# Getting started

What works so far. Each story that adds a step updates this page when it merges.

## What works today

The workspace installs, checks and builds, and the API and the web app start. There is no database yet (P-9), and the web app's real sign-in comes with P-10.

1. Install Git, Node 24.22.0 (the version in [`.node-version`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/.node-version)) and pnpm 12: `npm install -g pnpm@12.14.0`.
2. Clone the repository:

   ```sh
   git clone https://github.com/xiu2809xiu-rgb/orderpilot.git
   cd orderpilot
   ```

3. Commit with your GitHub no-reply email, never a school email. You will find it on GitHub under Settings, Emails. Set it for this repository:

   ```sh
   git config user.email "<your GitHub no-reply address>"
   ```

4. Read these, in order:
   - [CLAUDE.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/CLAUDE.md): the product brief, the standards and the Definition of Done.
   - [AGENTS.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/AGENTS.md): the rules for your AI tool.
   - [The working agreement](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/working-agreement.md): how the team works.
   - [The backlog](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/backlog.md): what is planned.

5. Install and check:

   ```sh
   pnpm install
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

6. Run the API. It needs one root `.env`, copied from the example:

   ```sh
   cp .env.example .env        # PowerShell: Copy-Item .env.example .env
   pnpm --filter @orderpilot/api dev
   ```

   Then open <http://localhost:3000/health> and <http://localhost:3000/api/docs>. If a required setting is missing, the API stops and names the file to create. A variable set in your shell always wins over the files.

7. Look at the web app:

   ```sh
   pnpm --filter @orderpilot/web dev
   ```

   Open http://localhost:5173. The login page shows the demo roles when the API is running with demo mode on. `CONTRIBUTING.md` lists every web command, the ports and where each area's screens go.

Line endings need no set-up. `.gitattributes` keeps text files LF on every machine.

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

## What later stories bring

| Step                                                              | Story |
| ----------------------------------------------------------------- | ----- |
| PostgreSQL, Redis and MinIO in Docker, with the ports from `.env` | P-9   |
| The full stack with `docker compose up --build`                   | P-13  |
| End-to-end tests with Playwright and axe                          | P-14  |
