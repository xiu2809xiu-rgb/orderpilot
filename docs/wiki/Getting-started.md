# Getting started

What works so far. Each story that adds a step updates this page when it merges.

## What works today

The workspace installs, checks and builds, and the API starts against a local PostgreSQL, Redis and MinIO. There is no web app yet.

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

5. Start Docker Desktop (Windows, macOS) or Docker Engine (Linux), then copy the settings file. One root `.env` is enough, and its defaults are safe for a laptop:

   ```sh
   cp .env.example .env        # Git Bash, macOS, Linux. PowerShell: Copy-Item .env.example .env
   pnpm stack:up               # PostgreSQL, Redis and MinIO; the first run compiles MinIO and takes a few minutes
   ```

6. Install and check. The tests use the stack, so start it first:

   ```sh
   pnpm install
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

7. Create the tables, seed them, and run the API:

   ```sh
   pnpm db:migrate
   pnpm db:seed
   pnpm --filter @orderpilot/api dev
   ```

   Then open <http://localhost:3000/health/ready> (database, Redis and storage should all say `up`) and <http://localhost:3000/api/docs>. The ports are the first lines of `.env` (`POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT`): change one and every URL built from it moves. `pnpm stack:down` stops the containers and keeps your data. If a required setting is missing, the API stops and names the file to create. A variable set in your shell always wins over the files.

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

## Troubleshooting

**Docker is not running.** `docker compose up` says it cannot connect to the Docker daemon, or the tests say that nothing answers on the database port. Start Docker Desktop (Windows and macOS) and wait until it says it is running, then run `docker compose up -d --wait` again. On Linux: `sudo systemctl start docker`.

**Port already in use.** `docker compose up` says a port is already allocated or already in use. Something else on your machine has 5432 (PostgreSQL), 6379 (Redis), 9000 or 9001 (MinIO). Either stop it, or move the stack: change one line in your `.env`, for example `POSTGRES_PORT=5433`, and run `docker compose up -d --wait` again. The database URLs are built from the port, so nothing else needs to change. To see who holds a port: `netstat -ano | findstr :5432` (PowerShell and Command Prompt) or `lsof -i :5432` (macOS and Linux).

**`role "orderpilot" does not exist`** (or `password authentication failed`). Another PostgreSQL is answering on the port, usually one installed on your machine, not the one in Docker. Our database never saw the request. Stop the other one, or give ours a free port with `POSTGRES_PORT=5433` in `.env` and run `docker compose up -d --wait` again. `docker compose ps` shows which ports our containers hold.

**Changed `.env` and nothing moved.** A variable set in your shell wins over the file, and the API never overrides it. Check with `echo $POSTGRES_PORT` (PowerShell: `$env:POSTGRES_PORT`), and unset it. Then run `docker compose up -d --wait` so the containers pick up the new ports.

**The first `docker compose up` takes minutes.** It compiles MinIO from its source once. Later starts use the cached image.

**Start again from nothing.** `docker compose down` stops and removes the containers and keeps your data. Removing the data too (`docker compose down -v`) deletes the volumes: ask first, and know that it cannot be undone.

## What later stories bring

| Step                                            | Story |
| ----------------------------------------------- | ----- |
| The full stack with `docker compose up --build` | P-13  |
| End-to-end tests with Playwright and axe        | P-14  |
