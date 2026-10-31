# ADR 0003: A pnpm monorepo with a hardened supply chain

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-5

## Context

OrderPilot will hold an API (P-8), a web app (P-11), a mock of Navision (P-19) and shared packages for contracts, configs and synthetic data. Four owners work in it at once, and each area must stay easy to find. The shared contracts must change in one place and reach every app in the same commit.

Every dependency is code that runs on our machines and in CI. Recent npm attacks published a malicious version of a popular package and relied on people installing it within hours, often through an install script. Our work also runs on Windows (Git Bash) and macOS, so every hook and script has to work on both.

## Decision

1. **One repository, one pnpm workspace.** `pnpm-workspace.yaml` globs `apps/*`, `services/*` and `packages/*`. The root `package.json` holds only tooling and the root scripts: `lint`, `typecheck`, `test`, `build`, `format`, `format:check` and the guards (`check:dashes`, `check:samples`, `check:samples:history`, `check:licence-key`, `check:secrets`). The root scripts run the repository-wide tools first, then each package's own script with `pnpm -r --if-present`, so a package that adds `test` or `build` is picked up without editing the root.
2. **pnpm 12, pinned.** `packageManager` is `pnpm@12.14.0` and `engines` asks for Node 24.22.0 or later on 24, matching `.node-version`. pnpm's strict `node_modules` stops a package from importing what it did not declare.
3. **Shared configs as packages.** `packages/tsconfig` and `packages/eslint-config` are real workspace packages (`@orderpilot/tsconfig`, `@orderpilot/eslint-config`), so every app extends one config and a rule changes in one place. ADR 0004 covers what is in them.
4. **The supply-chain settings** live in `pnpm-workspace.yaml`, each with a comment saying why:
   - **Exact pins:** `saveExact: true`, so `pnpm add` writes `1.2.3`, never `^1.2.3`. Peer ranges in shared packages are the one exception, since a peer range is a promise to the consumer, not an install.
   - **`minimumReleaseAge: 10080`** (7 days, in minutes). pnpm refuses any version younger than that, transitive ones included. Most malicious releases are found and pulled within days, and 7 days is the same as Dependabot's cooldown, so every update Dependabot proposes is old enough to install. `minimumReleaseAgeStrict` is on by default once the age is set, so resolution fails rather than quietly picking an older version. A fix that cannot wait goes in `minimumReleaseAgeExclude` by exact version, with a reason and a review date. pnpm's own default is one day; we chose seven.
   - **`blockExoticSubdeps: true`.** A transitive dependency may come only from the registry, never a git URL or a tarball link. Semgrep's pnpm rules flagged its absence on the first scan.
   - **`trustPolicy: no-downgrade`.** The install fails if a package's new version has weaker publish evidence than earlier ones, such as lost provenance, a common sign of a hijacked account.
   - **`allowBuilds: {}`, reviewed.** pnpm 12 runs no dependency build script unless `allowBuilds` names the package, and fails the install on any unreviewed one (`strictDepBuilds` is on by default). Today no dependency needs one. Each later entry says what its script does and when it was reviewed.
   - **`overrides: {}`.** None are needed. Each later entry needs a reason and a review date.
   - **`audit`:** `level: high`, and `ignore` lists accepted advisories by GHSA id, each with a reason and a review date. The one entry today is a moderate minimatch advisory reached only by dev tools; [security testing](../security/security-testing.md) records the triage, and `osv-scanner.toml` holds the same entry for the OSV scan.
   - **`peerDependencyRules`:** eslint-plugin-jsx-a11y 6.10.2 declares ESLint up to 9. Its tests in `packages/eslint-config` show its rules working on ESLint 10, so ESLint 10 is allowed for it until the plugin declares it.
5. **Dependabot** (`.github/dependabot.yml`) updates npm and GitHub Actions weekly, on Monday at 06:00 Singapore time, with a 7-day cooldown. Minor and patch updates come grouped in one pull request each week; majors come one at a time. Commit messages follow Conventional Commits (`build(deps): …`, `ci: …`). Two ignores, each with its reason in the file: `@types/node` majors, so Node's types stay on 24 with `.node-version`, and TypeScript 6.1 or later until typescript-eslint supports it.
6. **Git hooks without a hook manager.** `.githooks/` holds three short sh scripts that call Node files in `scripts/git-hooks/`, and the root `prepare` script points `core.hooksPath` at `.githooks` on `pnpm install` (never in CI). Plain sh plus Node runs the same in Git Bash on Windows and in sh on macOS, and saves a dependency. The hooks:
   - **commit-msg:** commitlint (config-conventional, limited to our ten types) and the em-dash check on the message;
   - **pre-commit:** the licence-key guard, the samples guard and the em-dash check on the staged content, then lint-staged (secretlint, ESLint and Prettier on the staged files, with `--max-arg-length 4096` so Windows' command-line limit is never hit);
   - **pre-push:** refuses any push that would update, create or delete `main` on the remote, whatever the refspec (`main`, `HEAD:main`, `x:refs/heads/main`, `--all`, `--mirror`, `:main`), and says how to push a branch instead. Then it runs the samples guard on every commit being pushed.
7. **The guards are plain Node with no dependencies** (`scripts/check-*.mjs`), so they run before `pnpm install` finishes, in hooks, and in CI. Each has `node --test` tests that drive real Git repositories, and each test was seen failing against a deliberately broken copy of its guard.

## Consequences

- One clone, one install and one set of commands for the whole product. Shared contracts change in one commit.
- A new package version waits a week before anyone can install it. A security fix that cannot wait needs a dated exclusion, and that is deliberate friction.
- The pull request rule holds on every machine with the hooks installed, even where GitHub's ruleset would let an admin through. `git push --no-verify` still skips the hook, and the `Protect main` ruleset stays the server-side control.
- `pnpm install` skips the root `prepare` script when nothing changed, so a clone that installed before the hooks existed runs `pnpm run prepare` once. CONTRIBUTING.md says so.
- `core.hooksPath` is repository config, which Git worktrees of the same clone share. A worktree on a branch without `.githooks` simply runs no hooks.
- pnpm 12 writes `packageManagerDependencies` into `pnpm-lock.yaml` (lockfile 9.0). If Dependabot cannot read it, its pull requests will fail visibly and we update by hand until it can.
- The hooks need Node on `PATH` and the workspace installed. A hook that cannot find a tool stops and says to run `pnpm install`, rather than skipping a check quietly.
