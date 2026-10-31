# Build report

One short section per prompt.

## Prompt 001: Build the OrderPilot base

The brief is [Prompt 001](ai/prompts/001-build-the-base.md). The base started on 2026-10-31.

### Step 0

Read back from GitHub with `gh` and from `docker ps` on 2026-10-31.

| Item                                   | Result                                                                                                                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruleset `Protect main`                 | Active on the default branch, id 26237777. Rules: deletion, non-fast-forward, and pull requests (0 approvals, stale reviews dismissed, threads resolved, merge commits or squash). Admin bypass in pull request mode. No required checks yet |
| Delete head branches after merge       | On                                                                                                                                                                                                                                           |
| Merge methods                          | Merge commits and squash only                                                                                                                                                                                                                |
| Default workflow permissions           | Read-only                                                                                                                                                                                                                                    |
| Dependabot alerts and security updates | On                                                                                                                                                                                                                                           |
| Secret scanning with push protection   | On                                                                                                                                                                                                                                           |
| Private vulnerability reporting        | On                                                                                                                                                                                                                                           |
| Issues, Projects and wiki              | On, and the wiki repository already exists                                                                                                                                                                                                   |
| Containers                             | None running                                                                                                                                                                                                                                 |
| First two issues                       | #1 for P-1 and #2 for P-2                                                                                                                                                                                                                    |

### Stories

Each story fills in its own row in its pull request. The next story marks the row before it as merged.

| Story | Branch                           | Pull request                                              | State             | Notes                                                                                                |
| ----- | -------------------------------- | --------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| P-1   | `docs/ground-rules`              | [#3](https://github.com/xiu2809xiu-rgb/orderpilot/pull/3) | Pull request open | Docs and repository files only, so there are no `pnpm` results. Its traceability row is due with P-3 |
| P-2   | `chore/github-process`           |                                                           | Not started       | Back-fill issue #1 into `Sprint 01 (W2)` if it closes by 1 Nov: the recorder does not exist yet      |
| P-3   | `docs/problem-and-questions`     | PR_PENDING                                                | Pull request open | Shares its pull request with P-4. Docs only, so there are no `pnpm` results                          |
| P-4   | `docs/problem-and-questions`     | PR_PENDING                                                | Pull request open | Built on P-3's branch, in the same pull request. Each area base fills in its guide                   |
| P-5   | `chore/monorepo-tooling`         |                                                           | Not started       |                                                                                                      |
| P-6   | `ci/verify-and-scan`             |                                                           | Not started       |                                                                                                      |
| P-7   | `feat/platform-shared-contracts` |                                                           | Not started       |                                                                                                      |
| P-8   | `feat/platform-api-shell`        |                                                           | Not started       |                                                                                                      |
| P-9   | `feat/platform-database`         |                                                           | Not started       |                                                                                                      |
| P-10  | `feat/platform-auth`             |                                                           | Not started       |                                                                                                      |
| P-11  | `feat/platform-web-shell`        |                                                           | Not started       |                                                                                                      |
| P-12  | `feat/platform-web-components`   |                                                           | Not started       |                                                                                                      |
| P-13  | `ci/docker`                      |                                                           | Not started       |                                                                                                      |
| P-14  | `test/e2e-smoke`                 |                                                           | Not started       |                                                                                                      |
| P-15  | `feat/platform-events`           |                                                           | Not started       |                                                                                                      |
| P-16  | `docs/diagrams`                  |                                                           | Not started       |                                                                                                      |
| P-17  | `feat/area1-ai-gateway`          |                                                           | Not started       |                                                                                                      |
| P-18  | `feat/area1-document-intake`     |                                                           | Not started       |                                                                                                      |
| P-19  | `feat/area1-mock-navision`       |                                                           | Not started       |                                                                                                      |
| P-20  | `feat/area1-connectors`          |                                                           | Not started       |                                                                                                      |
| P-21  | `feat/area1-synthetic-documents` |                                                           | Not started       |                                                                                                      |
| C-1   |                                  |                                                           | Not started       | Area 2 base                                                                                          |
| D-1   |                                  |                                                           | Not started       | Area 3 base                                                                                          |
| F-1   |                                  |                                                           | Not started       | Area 4 base: access policy and masking                                                               |
| F-2   |                                  |                                                           | Not started       | Area 4 base: the audit viewer                                                                        |
| G-1   |                                  |                                                           | Not started       | Area 4 base: monitoring                                                                              |
| P-22  | `feat/platform-design-system`    |                                                           | Not started       | Only once Richie says the repository is private and the keys are in place                            |
| P-23  | `feat/area1-order-constellation` |                                                           | Not started       |                                                                                                      |
| P-24  | `feat/platform-deploy`           |                                                           | Not started       | Only once Richie confirms step 8 of his guide                                                        |
| P-25  | `docs/slides`                    |                                                           | Not started       |                                                                                                      |

### Notes

- **Node.** `.node-version` is 24.22.0. The machine's own Node is 24.15.0, and Richie needs to upgrade it. The build used a portable 24.22.0 instead.
- **Git identity.** The repository's local git config uses the GitHub no-reply address. GitHub writes merge commits itself, so that config does not reach them: its test merge of P-1 carries the email on Richie's GitHub account, as the first commit on `main` does. GitHub refuses the no-reply address as a merge author (`--author-email` fails with `Invalid email address`) until Richie turns on Keep my email addresses private, so until then merge commits carry that same address, which is already public on `main`. The first commit stays as it is, because rewriting it needs a force push.
- **ADR 0002 and the brief.** ADR 0002 differs from the brief on purpose. The brief calls the earlier repository archived, but it stays unarchived for now, by Richie's decision of 2026-10-29. The prompt stays unchanged.
- **A second ruleset.** `protect-main`, id 26237858, is also active on the default branch. Step 0 did not ask for it. It has the same deletion, non-fast-forward and pull request rules, but allows rebase, does not require threads to be resolved and has no bypass. GitHub applies both, so the stricter rule wins and merging still works as step 0 intends. It stays in place until Richie decides, because removing it is his call. P-2's `rulesets/main.json` has to know the answer.
- **The board.** A private board called OrderPilot delivery already exists, with Status, Sprint, Estimate and Area fields. Its 51 earlier items all come from another repository, and this story left them alone. Issue #1 is on it, at In Progress. P-2 has to adopt it or replace it, and clearing those items needs Richie's yes.
- **For P-5.** `.claude/settings.json` has no final newline and stays byte for byte, so it fails Prettier as it is and must go in `.prettierignore`. The prompt stays unchanged too, though it already passes. `samples/*` is the brief's rule and covers the root folder only, so `scripts/check-samples.mjs` should also refuse client-document types under any folder called `samples`.
- **For P-22.** `.mcp.json` is ignored for now, because ReUI's token must stay out of Git. P-22 decides whether a version without the token is tracked, before any token is written.
