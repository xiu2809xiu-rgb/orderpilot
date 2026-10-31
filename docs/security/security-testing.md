# Security testing

What scans OrderPilot, where it runs, and what we do with a finding. [`SECURITY.md`](../../SECURITY.md) says how to report a problem. [ADR 0006](../adr/0006-devsecops-tools.md) records why these tools, and [ADR 0003](../adr/0003-pnpm-monorepo.md) the supply-chain settings.

**Status words.** "Today" means it runs now. "Planned" names the story that brings it.

## What runs where

### On your machine, before Git records anything

The hooks in `.githooks/` are installed by `pnpm install` (see [CONTRIBUTING.md](../../CONTRIBUTING.md#set-up)).

| Hook       | Check                                                                                              | Tool                            | Status      |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------- | ----------- |
| commit-msg | Conventional Commits, and no em dash in the message                                                | commitlint, `check-dashes.mjs`  | Today (P-5) |
| pre-commit | The value of `REACTBITS_LICENSE_KEY` or `REUI_LICENSE_KEY` in a staged file, or an env file staged | `check-licence-key.mjs`         | Today (P-5) |
| pre-commit | A client sample staged, in the root `samples/` or as a document in any folder called `samples`     | `check-samples.mjs`             | Today (P-5) |
| pre-commit | Secret-shaped strings (tokens, private keys, connection strings) in the staged files               | secretlint (recommended preset) | Today (P-5) |
| pre-commit | Em dashes in the staged files; then ESLint and Prettier on them                                    | `check-dashes.mjs`, lint-staged | Today (P-5) |
| pre-push   | Any push that would update, create or delete `main`                                                | `pre-push.mjs`                  | Today (P-5) |
| pre-push   | A client sample in any commit being pushed                                                         | `check-samples.mjs`             | Today (P-5) |

The licence-key guard reads the real values from `apps/web/.env.local` on your machine, never prints them, and names only the file and the variable. `git commit --no-verify` and `git push --no-verify` skip the hooks: never use them. CI and the `Protect main` ruleset catch what a skipped hook lets through.

### In CI, on every pull request and every push to main

| Workflow       | Job (the required check's name) | What it does                                                                                                                                                                                        | Status      |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci.yml`       | Lint, typecheck, test, build    | The samples check over every commit in the history, a frozen install, `pnpm audit --audit-level high`, format, the em-dash check, the licence-key and env-file guard, lint, typecheck, tests, build | Today (P-6) |
| `security.yml` | SAST (Semgrep)                  | Semgrep with `p/default`, `p/typescript`, `p/react`, `p/nodejs` and `p/owasp-top-ten`, failing on any finding                                                                                       | Today (P-6) |
| `security.yml` | Secret scan (gitleaks)          | gitleaks over every commit in the history, findings redacted                                                                                                                                        | Today (P-6) |
| `security.yml` | Dependency scan (OSV)           | OSV-Scanner on `pnpm-lock.yaml`, failing on any advisory that `osv-scanner.toml` does not accept                                                                                                    | Today (P-6) |

`security.yml` also runs every Monday at 06:30 Singapore time, so a new advisory against an unchanged lockfile still shows up. Semgrep and gitleaks keep a SARIF report as a run artifact for 14 days.

### On GitHub

| Control                                                   | Status                                     |
| --------------------------------------------------------- | ------------------------------------------ |
| Dependabot alerts and security updates                    | Today, reading `pnpm-lock.yaml` from P-5   |
| Dependabot version updates, weekly on Monday 06:00 SGT    | Today (P-5)                                |
| Secret scanning with push protection                      | Today, while the repository is public      |
| Private vulnerability reporting                           | Today, while the repository is public      |
| The `Protect main` ruleset, with the four checks required | The checks become required when P-6 merges |

### Later

| Control                                                                                 | Status        |
| --------------------------------------------------------------------------------------- | ------------- |
| Trivy image scan, failing on fixable HIGH or CRITICAL findings, and a Trivy config scan | Planned: P-13 |
| End-to-end tests with axe, including the refusals of E2E #3                             | Planned: P-14 |
| OWASP ZAP baseline scan of the live URL, weekly and on demand                           | Planned: P-24 |
| Lighthouse at each release                                                              | Planned: P-24 |

## Triage

Every finding gets one of three outcomes. The person whose pull request it blocks proposes one, and the owner of the code agrees it in review: the area's owner, or for shared files the reviewers that `docs/team/module-ownership.md` lists (planned: P-4; Richie until then).

1. **Fix it.** The default. Upgrade the dependency, change the code, or remove the secret. A real secret that reached a pushed commit is also **rotated at once** and reported to Richie, because the history keeps it.
2. **Accept it,** when the risk is real but does not apply to how we use the code, and no fix is available yet. Record it where the tool reads it, with a reason and a review date, and add it to the table below.
3. **Dismiss it,** when the finding is wrong (a false positive). Record why, with a review date, in the same places.

Where to record an accepted or dismissed finding:

| Tool         | Where                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| OSV-Scanner  | `osv-scanner.toml`: `[[IgnoredVulns]]` with `id`, `ignoreUntil` (the review date) and `reason`         |
| `pnpm audit` | `pnpm-workspace.yaml`, under `audit.ignore`, by GHSA id, with the reason and review date above it      |
| Semgrep      | A `// nosemgrep: <rule-id>` comment on the line, followed by the reason and the review date            |
| gitleaks     | `.gitleaksignore`, by the finding's fingerprint, with the reason and review date in a comment above it |
| secretlint   | `.secretlintignore`, or a `secretlint-disable-line` comment, with the reason and review date           |
| Dependabot   | Dismiss the alert on GitHub with a reason, and add a row below                                         |

- A review date is at most 30 days away. On that date the entry is fixed, renewed with a new reason, or removed. `osv-scanner.toml` fails the scan again by itself once `ignoreUntil` passes.
- Never weaken a rule, drop a scan or lower a threshold to get a green run. That change needs its own pull request and Richie's yes.
- A Dependabot pull request that fails a check is fixed on its own branch like any other.

### Accepted and dismissed findings

| Finding                                               | Tool              | Outcome  | Reason                                                                                                                                                                                                                                                                                                                                                                                                        | Recorded                                              | Review     |
| ----------------------------------------------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| GHSA-g3hv-75wg-m249, minimatch below 11.0.1, moderate | OSV, `pnpm audit` | Accepted | Denial of service through an attacker-supplied glob pattern. Only dev tools reach it (ESLint, Prettier and others), and they match patterns we write; nothing ships. The fix is a new major, published 2026-10-27, inside our 7-day release-age window, and the tools still ask for minimatch 3 and 10                                                                                                        | `osv-scanner.toml`, `pnpm-workspace.yaml`, 2026-10-31 | 2026-11-14 |
| GHSA-3g3m-2fjr-6pw4, glob 13.0.6, medium              | OSV               | Accepted | A walk that is aborted keeps reading directories. Only `@sentry/bundler-plugins` (build-time source-map tooling, a dependency of `@sentry/node`) reaches it, and we never call it or pass glob an abort signal. The fix is glob 14.0.2, published 2026-10-27, inside our 7-day release-age window until 2026-11-03: an override to it replaces this entry (G-1, [ADR 0022](../adr/0022-sentry-for-errors.md)) | `osv-scanner.toml`, 2026-11-01                        | 2026-11-06 |

## When the repository goes private

GitHub secret scanning, push protection and private vulnerability reporting stop. gitleaks, secretlint and Semgrep keep covering secrets and code, and none of our scans uploads to code scanning, so nothing else changes. Then `SECURITY.md`, this file and `.github/rulesets/main.json` are updated (CLAUDE.md, rule 8).
