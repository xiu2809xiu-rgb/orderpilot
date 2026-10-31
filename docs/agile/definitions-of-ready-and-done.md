# Definitions of Ready and Done

What ready and done mean at each level: each story, each sprint, and each assessment release.

## Definition of Ready

### Story

A story is ready to start when all of this is true.

1. It is an issue under its epic, with a clear title.
2. Its acceptance criteria are written, and each one can be checked.
3. It has an estimate, a priority and an area.
4. It traces to at least one of M1 to M6.
5. Its dependencies are done, or are named and do not block it.
6. No open client question blocks it. An open business rule is built as configuration until Spectra confirms it.
7. Any data it needs is synthetic and available.
8. Someone with room under the work-in-progress limit can take it.
9. It is small enough for one branch and one pull request.

### Sprint

A sprint is ready to start when all of this is true.

1. Its milestone exists (planned: P-2).
2. The top of the backlog is in order: Must, then Should, then Could, then continuous work.
3. There are enough ready stories for everyone to pull from.
4. The reviewer rota is set.
5. Assessments and known absences for the week are noted.

### Assessment release

Work towards a release in Week 5, 13 or 18 is ready to start when all of this is true.

1. The scope is agreed from the MoSCoW list.
2. The feature freeze date is set.
3. The tag name is confirmed.
4. Everyone knows which part of the demo they present.
5. The demo's data is synthetic and available.

## Definition of Done

### Story

A story is done when all of this is true. [CLAUDE.md](../../CLAUDE.md#10-definition-of-done) holds the same list.

1. Every acceptance criterion is met, with evidence in the pull request.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, and so does `docker compose up --build` once it exists. The pull request shows their real results.
3. New behaviour has tests at the right level, and domain logic stays at 80% or more unit coverage.
4. The story brought its own pieces: its models and migration, tests, `.env.example` entries and `.http` request files; an ADR if it made a decision; rows in the traceability matrix and `docs/architecture/patterns.md`; one row in the AI usage log.
5. UI changes handle every state, meet WCAG 2.2 AA, and have screenshots in light and dark from a Docker build of the branch, saved in `docs/design/screenshots/<area>/`.
6. The docs match what exists, and nothing claims to exist before it does.
7. No AI attribution, no em dashes, synthetic data only, no keys in Git and no AI tool folders.
8. Every required check is green and every review thread is resolved.
9. The pull request is merged with a merge commit, the branch is deleted, the issue is closed, and the story is at Done on the board, in the milestone of the week it finished.

Items that depend on something not yet built apply from the story that brings it: the milestones arrive in P-2, no `pnpm` command exists until P-5, and the traceability matrix and patterns file arrive in P-3 and P-8. Until then, the pull request says so plainly.

### Sprint

A sprint is done when all of this is true. Sprints never cap the work, so unfinished work simply stays on the board.

1. Every story finished this week is in this sprint's milestone (planned: P-2).
2. Each day worked has its daily note on the milestone (planned: P-2; until then, on the story's issue).
3. The sprint report has been run and shared (planned: P-2).
4. The sprint review and the retrospective have been held.
5. The retrospective's actions are tasks in the backlog.
6. `main` is green.
7. The AI usage log is up to date.

### Assessment release

A release is done when all of this is true.

1. A feature freeze was held, and only fixes merged after it.
2. Every required check is green on the commit being tagged.
3. A clean clone starts with `docker compose up --build`.
4. The release's end-to-end tests pass, with WCAG 2.2 AA checked.
5. Lighthouse scores 90 or more, and LCP is under 2.5 s.
6. Once deployed, the latest OWASP ZAP report has been triaged.
7. ADRs, traceability, the test plan, the AI usage log and the build report are up to date.
8. The demo shows only synthetic data, labelled "Synthetic demo data".
9. Each member can explain their own code.
10. The tag below is on `main`.

| Week | Assessment       | Weight | Tag                     | What must be in it                                                                                                                                                                                                                                  |
| ---- | ---------------- | ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5    | Proposal         | 25%    | `v0.1-proposal`         | The Must list, the sales pilot: PO upload with AI classification and extraction, uncertain fields confirmed, stock lookup, SPR, the tracker, one mismatch and the server-side permission check. E2E #1 passes, and the proposal deck is ready (T-5) |
| 13   | Technical review | 25%    | `v0.2-technical-review` | The Should list, in order: the payment gate; a PI draft; full matching; AWB/BL and permit follow-ups; email intake with AI-drafted updates; more rules                                                                                              |
| 18   | Final            | 35%    | `v1.0-final`            | Phase 2 as well: the purchase flow, with the bank-detail check. E2E #1 to #4 pass, and the [targets](../../CLAUDE.md#targets) are measured                                                                                                          |

The Week 7 mock interview (15%, individual) has no release tag. T-8 prepares for it.
