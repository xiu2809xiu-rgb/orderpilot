# Backlog

Rendered from [`scripts/github/data/backlog.json`](../../scripts/github/data/backlog.json) by `node scripts/github/render-docs.mjs`. Change the data, not this file. The same data seeds the issues. The board shows where each story stands.

There are 9 epics and 65 stories. Estimates are story points: a first guess, for the team to change at planning.

## Epics

| Epic   | Title                             | Area                                    | Stories | Points |
| ------ | --------------------------------- | --------------------------------------- | ------- | ------ |
| Epic P | The platform base                 | `area: 1 document AI and integration`   | 27      | 169    |
| Epic A | Document intake and AI extraction | `area: 1 document AI and integration`   | 5       | 31     |
| Epic B | Master data and Navision          | `area: 1 document AI and integration`   | 4       | 14     |
| Epic C | Order workflows and approvals     | `area: 2 order workflows and approvals` | 4       | 26     |
| Epic D | Checks, the tracker and insights  | `area: 3 checks tracker and insights`   | 4       | 23     |
| Epic E | AI with a person in the loop      | `area: 1 document AI and integration`   | 6       | 29     |
| Epic F | Financial controls and governance | `area: 4 controls and monitoring`       | 5       | 24     |
| Epic G | Monitoring                        | `area: 4 controls and monitoring`       | 1       | 8      |
| Epic T | Team stories                      | `area: team`                            | 9       | 36     |

## Ready to pull

The starter stories for areas 2, 3 and 4. Their owners start on them on Monday 2 Nov and refine them, and at the handover prompt 003 writes the rest from the owners' notes. They sit at Ready on the board.

| Story | Title                                                              | Area                                    | Points |
| ----- | ------------------------------------------------------------------ | --------------------------------------- | ------ |
| C-2   | The order state machine for the sales flow                         | `area: 2 order workflows and approvals` | 8      |
| C-3   | SPR approval within limits                                         | `area: 2 order workflows and approvals` | 5      |
| C-4   | Reminders and escalations                                          | `area: 2 order workflows and approvals` | 5      |
| D-2   | The packing-list quantity check against the PO                     | `area: 3 checks tracker and insights`   | 5      |
| D-3   | The exceptions queue flow                                          | `area: 3 checks tracker and insights`   | 5      |
| D-4   | The tracker's status, owner and overdue flags from workflow events | `area: 3 checks tracker and insights`   | 5      |
| F-3   | The authorisation policy with approval limits                      | `area: 4 controls and monitoring`       | 5      |
| F-4   | No self-approval and segregation of duties                         | `area: 4 controls and monitoring`       | 3      |
| F-5   | The bank-detail hold                                               | `area: 4 controls and monitoring`       | 5      |

## In pull order

Whoever is free pulls the next ready story from the top: Must, then Should, then Could, then continuous work. During the base, work through the stories in order, without waiting between them.

| Story | Title                                                              | Priority | Points | Area                                    | Requirements                                                   |
| ----- | ------------------------------------------------------------------ | -------- | ------ | --------------------------------------- | -------------------------------------------------------------- |
| P-1   | Ground rules                                                       | must     | 5      | `area: team`                            | M3 AI-assisted coding, M4 best practices, M5 team Git workflow |
| P-2   | GitHub as code                                                     | must     | 8      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-3   | The problem, the research and the questions                        | must     | 8      | `area: team`                            | M1 design thinking, M2 GRS by design                           |
| P-4   | The four areas                                                     | must     | 5      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-5   | Monorepo and tooling                                               | must     | 5      | `area: team`                            | M4 best practices, M5 team Git workflow                        |
| P-6   | CI and the security baseline                                       | must     | 5      | `area: team`                            | M2 GRS by design, M4 best practices, M5 team Git workflow      |
| P-7   | Shared contracts                                                   | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-8   | The API shell                                                      | must     | 5      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-9   | Database, Redis, document storage and the local stack              | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-10  | Sign-in and sessions                                               | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-11  | The web shell                                                      | must     | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-12  | Common components                                                  | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-13  | Docker images and the IaC scan                                     | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices, M6 deploy and monitor     |
| P-14  | End-to-end smoke                                                   | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-15  | Events, queues and live updates                                    | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-16  | Diagrams as code                                                   | must     | 3      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-17  | The AI gateway                                                     | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-18  | Document intake and storage                                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-19  | Mock Navision and synthetic master data                            | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-20  | The connector framework and the Navision adapter                   | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-21  | Synthetic documents                                                | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| C-1   | Area 2 base, the workflow module                                   | must     | 8      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| C-2   | The order state machine for the sales flow                         | must     | 8      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| C-3   | SPR approval within limits                                         | must     | 5      | `area: 2 order workflows and approvals` | M2 GRS by design, M4 best practices                            |
| C-4   | Reminders and escalations                                          | must     | 5      | `area: 2 order workflows and approvals` | M4 best practices                                              |
| D-1   | Area 3 base, checks and the tracker                                | must     | 8      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| D-2   | The packing-list quantity check against the PO                     | must     | 5      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| D-3   | The exceptions queue flow                                          | must     | 5      | `area: 3 checks tracker and insights`   | M2 GRS by design, M4 best practices                            |
| D-4   | The tracker's status, owner and overdue flags from workflow events | must     | 5      | `area: 3 checks tracker and insights`   | M4 best practices                                              |
| F-1   | Area 4 base, access policy and masking                             | must     | 8      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-2   | Area 4 base, the audit viewer                                      | must     | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-3   | The authorisation policy with approval limits                      | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-4   | No self-approval and segregation of duties                         | must     | 3      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| F-5   | The bank-detail hold                                               | must     | 5      | `area: 4 controls and monitoring`       | M2 GRS by design, M4 best practices                            |
| G-1   | Area 4 base, monitoring                                            | must     | 8      | `area: 4 controls and monitoring`       | M2 GRS by design, M6 deploy and monitor                        |
| P-24  | Cloud deployment                                                   | must     | 8      | `area: 1 document AI and integration`   | M4 best practices, M6 deploy and monitor                       |
| P-25  | Slides as code                                                     | must     | 3      | `area: team`                            | M4 best practices                                              |
| P-26  | Generated API hooks and mocks                                      | must     | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| T-1   | Owners, backups and reviews                                        | must     | 2      | `area: team`                            | M5 team Git workflow                                           |
| T-2   | The briefing call with Spectra                                     | must     | 2      | `area: team`                            | M1 design thinking                                             |
| T-3   | The project plan                                                   | must     | 3      | `area: team`                            | M5 team Git workflow                                           |
| T-4   | The UI prototype across the four areas                             | must     | 8      | `area: team`                            | M1 design thinking, M4 best practices                          |
| T-5   | The proposal deck and presentation                                 | must     | 5      | `area: team`                            | M1 design thinking, M2 GRS by design                           |
| T-6   | Design thinking                                                    | must     | 5      | `area: team`                            | M1 design thinking                                             |
| T-7   | GRS by design                                                      | must     | 5      | `area: team`                            | M2 GRS by design                                               |
| T-8   | Preparing for the mock interview                                   | must     | 3      | `area: team`                            | M3 AI-assisted coding, M4 best practices                       |
| T-9   | The handover                                                       | must     | 3      | `area: team`                            | M5 team Git workflow                                           |
| A-1   | Classification                                                     | must     | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| A-2   | Extraction with confidence and provenance                          | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-1   | The review screen, with source highlighting                        | must     | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-2   | The accuracy harness, with a 95% target and a comparison of models | must     | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-22  | The design system with the Pro kits                                | should   | 8      | `area: 1 document AI and integration`   | M4 best practices                                              |
| A-3   | Layout mapping, proposed by AI and approved by a person            | should   | 8      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| A-4   | Learning from corrections, one layout at a time                    | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| A-5   | Email intake through a mock mailbox with signed webhooks           | should   | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| B-1   | Duplicate-PO protection                                            | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| B-2   | A Navision-ready import file                                       | should   | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| B-3   | The template engine for PIs, invoices, packing lists and Excel     | should   | 5      | `area: 1 document AI and integration`   | M4 best practices                                              |
| E-3   | Prompt-injection tests                                             | should   | 3      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| P-23  | The 3D order constellation                                         | could    | 13     | `area: 1 document AI and integration`   | M4 best practices                                              |
| P-27  | Web shell polish                                                   | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| B-4   | QR codes on generated documents and carton labels                  | could    | 3      | `area: 1 document AI and integration`   | M4 best practices                                              |
| E-4   | Passkeys to confirm risky approvals                                | could    | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M4 best practices                            |
| E-5   | A first-run guided tour for each role                              | could    | 3      | `area: 1 document AI and integration`   | M1 design thinking, M4 best practices                          |
| E-6   | An "Ask OrderPilot" help panel that answers from our docs          | could    | 5      | `area: 1 document AI and integration`   | M2 GRS by design, M3 AI-assisted coding                        |

## Epic P: The platform base

The team's way of working, the running app and area 1's core, in the order Prompt 001 sets. Richie builds it for every area.

### P-1: Ground rules

The front matter, the rules for every AI tool, the repository files, the first ADRs and the agile docs.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M3 AI-assisted coding, M4 best practices, M5 team Git workflow
- **Branch:** `docs/ground-rules`
- **Planned for:** Sprint 01 (W2)

Acceptance criteria:

- Front matter: `README.md` (what OrderPilot is, its status, and links), `CONTRIBUTING.md` (set-up, workflow and how to add a component) and `SECURITY.md` (how to report, and what we scan).
- `AGENTS.md`, for every teammate's AI tool (Kiro, Copilot, Cursor, ChatGPT): never delete or overwrite anyone's work; write only in your own area; no force pushes; risky commands (`reset --hard`, `clean`, mass formatting) only after an explicit yes; no AI tool folders committed; no attribution, synthetic data only, and keys kept out of Git; the path from a story to `main`; a starter prompt to paste at the start of each session.
- `CLAUDE.md`: the product brief, then the stack and repository layout; the engineering standards (OOP layers and patterns; no `any`; validation at boundaries; one error envelope; comments that explain why); security, performance and testing; the UI rules; the Git and AI rules; the Definition of Done.
- Repository files: `.claude/settings.json` as Richie placed it; `.editorconfig`; `.gitattributes` with LF line endings; `.gitignore` covering every `.env*` except `.env.example`, `samples/*` except its README, build output and AI tool folders; `.node-version` set to `24.22.0`.
- ADRs: `docs/adr/0001-record-architecture-decisions.md`, and `0002-a-clean-repository-for-ps11.md` with the lecturer's request, nothing from other statements, the team lead building every area's base before the owners take over, and the earlier repository read for lessons only.
- `docs/agile/`: the README; the working agreement (roles, the sprint rules, ceremonies, the board, a work-in-progress limit of two per person, a reviewer of the day, and communication); the Definitions of Ready and Done, for each story, each sprint, and each assessment release (Weeks 5, 13 and 18, each tagged).
- `docs/ai/ai-usage-log.md`: one table per area, with the platform and area 1 first.
- The prompt moved to `docs/ai/prompts/001-build-the-base.md`.
- `docs/BUILD_REPORT.md`: one short section per prompt.

### P-2: GitHub as code

The labels, sprint calendar, board, backlog and wiki kept as code, and the sprint recorder.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/github-process`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-1

Acceptance criteria:

- `.github/`: issue forms for stories, tasks, epics, spikes and bugs, with blank issues off and contact links to this repository's security advisories and docs.
- `.github/`: the pull request template (rule 3, the areas, M1 to M6, a UI checklist, docs, data and security, and the Definition of Done).
- `.github/`: `CODEOWNERS`, with placeholders until T-1; `labels.json`; and `rulesets/main.json`, mirroring the live ruleset after every change.
- Labels: `type:` epic, story, task, bug, spike, chore, docs and security.
- Labels: `area: 1 document AI and integration`, `area: 2 order workflows and approvals`, `area: 3 checks tracker and insights`, `area: 4 controls and monitoring`, and `area: team`.
- Labels: `priority:` must, should and could; `req: M1` to `M6`, each with its name; `status: blocked`, `status: needs client input`, and `dependencies`.
- `scripts/github/`, all idempotent: labels.
- `scripts/github/`, all idempotent: the sprint calendar (Sprint 1 starts Monday 26 Oct 2026; each sprint is due Sunday 23:59 Singapore time).
- `scripts/github/`, all idempotent: a fresh board **OrderPilot delivery**, linked to this repository and found again only through that link, with Status (including Ready), a Sprint iteration, Estimate and Area, and Backlog and Sprint views. Project #2, `OrderPilot delivery (port attempt)`, is never touched.
- `scripts/github/`, all idempotent: the backlog as data: epics P, A to G and T, with the stories in prompts 001 and 002 and their acceptance criteria, estimates, priorities and areas, seeded as sub-issues of their epics, with every issue on the board.
- Existing issues are adopted by key, never duplicated: #1 P-1 (kept closed, in `Sprint 01 (W2)`), #2 P-2, #4 P-3, #5 P-4, #6 P-5 and #7 P-6. Adopting sets the body, the labels, the epic and the board fields.
- Three ready-to-pull starter stories each for areas 2, 3 and 4 (C-2 to C-4, D-2 to D-4 and F-3 to F-5), each with its acceptance criteria, at Ready on the board.
- `scripts/github/`, all idempotent: the rendered `docs/agile/backlog.md` and the wiki's sprint calendar.
- `scripts/github/`, all idempotent: wiki publishing.
- `.github/workflows/sprint-recorder.yml` sets an issue's milestone to the sprint of the day it closes, or of the day its pull request merges.
- `scripts/github/sprint-report.mjs` prints what closed this sprint and what is in progress, by area.
- `docs/wiki/`: Home, Getting started (what works so far), How we work, Definition of Done, Team and areas, Sprint calendar, Security, and the sidebar.
- After the merge, the scripts are run and the wiki is published. Richie groups the board's Backlog view by Sprint, which the API cannot do.

### P-3: The problem, the research and the questions

The problem in our words, what we assume, what we must ask Spectra, and the starting points for design thinking and GRS.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M1 design thinking, M2 GRS by design
- **Branch:** `docs/problem-and-questions`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- `docs/problem-statement.md`: the brief in our words, stakeholders, pain points, root cause, constraints, scope, success metrics and open questions.
- `docs/assumptions.md`.
- `docs/client/questions-for-client.md`: the three items to ask for first (anonymised samples of every document type including the SPR form; a Navision export; and the timeline of one real order), then the questions in priority order, and a note to send the priority questions before the briefing call.
- `docs/client/questions-for-client.md`: the six new questions in section 5.3 of prompt 002, after the existing priority questions.
- `docs/research/domain-notes.md`: section 5 of prompt 002, the domain notes, with every Navision detail marked as an assumption to confirm at the briefing call.
- `docs/data-formats.md`: the assumed formats of every document and Navision export, each to confirm, and how to try a client sample safely.
- `docs/agile/hero-journey.md`: the sales-pilot demo story, E2E #1 to #4, and a presenter slot for each area.
- `docs/requirements-traceability.md`: M1 to M6, planned features, where, and evidence.
- `docs/research/README.md`: where Richie's ERP notes go, in his own words only.
- `docs/design-thinking/`: the method; personas started from the role table; current and future journeys of the sales flow; how might we; hypotheses; and success metrics with a measurement protocol (time, touches and errors, manual against OrderPilot).
- `docs/grs/grs-by-design.md`: governance; a risk register (AI errors, bank-detail fraud, data leaking to AI providers, PDPA, prompt injection, ERP changes); and sustainability (less re-typing, fewer reshipments, and AI only where it helps, with its cost tracked).
- Nothing claims the prototype is PDPA compliant.

### P-4: The four areas

Who owns which paths, and a guide that lets each owner take over their area.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `docs/areas`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-3

Acceptance criteria:

- `docs/team/module-ownership.md`: the owners, the paths each area owns, the shared files and who reviews them, and backup owners (TBD until T-1).
- Four guides: `area-1-document-ai-and-integration.md`, `area-2-order-workflows-and-approvals.md`, `area-3-checks-tracker-and-insights.md` and `area-4-controls-security-and-monitoring.md`.
- Each guide covers the goal and user stories; the contracts; a recommended design (patterns, data flow, sequence); **What the base gives you** and **What's yours to build** (the A-level depth); what the owner explains at the Week 7 interview; the risks; and the module requirements it covers.

### P-5: Monorepo and tooling

The pnpm workspace, the strict shared configs, the Git hooks and the supply-chain settings.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M5 team Git workflow
- **Branch:** `chore/monorepo-tooling`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- A pnpm workspace (`apps/*`, `services/*`, `packages/*`) and root scripts.
- `packages/tsconfig` (strict) and `packages/eslint-config` (flat, type-aware, with jsx-a11y, failing on any warning).
- Prettier, commitlint (config-conventional), Dependabot (npm and Actions, weekly on Monday 06:00 Singapore time, a 7-day cooldown, grouped) and a fresh lockfile.
- Commit-message hook: commitlint.
- Pre-commit hook: the licence-key guard (the values of `REACTBITS_LICENSE_KEY` and `REUI_LICENSE_KEY` never in staged files), the samples guard, a secretlint scan, the em-dash check, and lint-staged.
- Pre-push hook: the samples guard on every commit being pushed.
- Pre-push hook: a guard that refuses any push to `main`, so the pull request rule holds on every teammate's machine, whatever GitHub enforces.
- Scripts: `scripts/check-licence-key.mjs`, `scripts/check-samples.mjs`, `scripts/check-dashes.mjs`, and `samples/README.md`.
- Supply-chain settings: exact version pins; `minimumReleaseAge`; reviewed `allowBuilds`; and overrides and ignored advisories, each with a reason and a review date.
- ADRs: pnpm monorepo; TypeScript and ESM.
- Type-check `scripts/github` under `checkJs`: the P-2 scripts are plain Node ESM with no types, so the root `tsconfig.json` excludes them today (about 800 errors). Add JSDoc types or move them to TypeScript, then remove the exclusion.

### P-6: CI and the security baseline

The verify job and the three security scans, required on every pull request from here on.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices, M5 team Git workflow
- **Branch:** `ci/verify-and-scan`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-5

Acceptance criteria:

- `ci.yml`, the `verify` job ("Lint, typecheck, test, build"): the samples history check; a frozen install; `pnpm audit --audit-level high`; format, the em-dash check, lint, typecheck, tests and build.
- `security.yml`, "SAST (Semgrep)": Semgrep with the default, TypeScript, React, Node and OWASP Top 10 rules.
- `security.yml`, "Secret scan (gitleaks)": across the full history.
- `security.yml`, "Dependency scan (OSV)": on the lockfile.
- Workflow hygiene: least-privilege `permissions`; actions pinned to commit SHAs; `concurrency` that cancels superseded runs; caching.
- No workflow-level path filters on required workflows.
- The four checks above are required from now on.
- `docs/agile/test-plan.md`: the test levels, environments and data, and a failure and edge-case matrix seeded with #11's cases, each marked planned with its story.
- `docs/security/security-testing.md`: what runs where, and the triage process (fix, or accept or dismiss with a reason and a review date).
- ADRs: the testing strategy; the DevSecOps tools.

### P-7: Shared contracts

One package of zod schemas and types that the API, the web app and the owners all build on.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-shared-contracts`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-5

Acceptance criteria:

- `packages/shared`, with zod schemas and types: the response envelope and the error envelope `{ error: { code, message, details, traceId } }`, and the error codes.
- `packages/shared`: the nine roles; the permissions the platform checks so far; the session and user reference; and the audit and AI-usage types.
- The first draft of the order and event contract: order headers and lines; documents and their types; field values with confidence and provenance; domain event names.
- OrderPilot's own record numbers: a type prefix, the date and a running number, like `SPR-20261102-0001`, shown beside Navision's numbers, which stay the official ones.
- The contract is marked "draft for the team to agree in Week 3", and status stays in area 2.
- ADR: shared contracts.
- Contract polish: publish the schemas as JSON Schema for the Swagger page and the mock Navision, add a contract test that fails on a breaking change, and prove the `exports` map through a Vite build once P-11 lands.

### P-8: The API shell

A layered NestJS API with typed configuration, security headers, logging, health checks and the architecture docs.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/platform-api-shell`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-7

Acceptance criteria:

- NestJS, in layers: controllers, services, repositories (the only place Prisma is called) and domain classes.
- Typed configuration: a zod schema; one root `.env` is enough (load `apps/api/.env`, then the root `.env`, never overriding what the shell, CI or Docker set, and skipping missing files quietly); a clear message naming the file to create when something required is missing.
- Security: helmet with a strict CSP, a CORS allow-list and rate limiting.
- Swagger "OrderPilot API" at `/api/docs`.
- pino with correlation ids, a global exception filter and a zod validation pipe.
- `/health`, `/health/live` and `/health/ready`.
- `apps/api/requests/*.http`, Vitest, and `docs/architecture/` (README and patterns).
- ADRs: NestJS layered modules; the observability baseline.
- API shell polish: keep the rate-limit counters in Redis once P-9 lands (the built-in store is per process), make the body-size limit and request timeout settings, drain open requests on shutdown, open Swagger UI in a real browser under its CSP (checked with curl only so far), and generate response-shape tests from the OpenAPI document.

### P-9: Database, Redis, document storage and the local stack

PostgreSQL with an append-only audit trail, Redis queues, S3-compatible storage and a local stack that starts from one `.env`.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-database`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-8

Acceptance criteria:

- Prisma with PostgreSQL: `User`, `RefreshToken`, `RolePermission`, and `AuditEvent` with an append-only trigger.
- The audit writer chains each event's hash to the one before it, verifies the chain, and joins the business transaction.
- Redis with BullMQ: the queue module.
- MinIO (S3-compatible) behind a storage service that uses the S3 API, so AWS S3 drops in later.
- The test harness: its own database and Redis database; a global set-up that migrates and seeds; and a data reset.
- `docker-compose.yml`: PostgreSQL, Redis and MinIO, under compose project name `orderpilot`.
- Ports from `.env`: `POSTGRES_PORT`, `REDIS_PORT` and `MINIO_PORT`, with `DATABASE_URL`, `REDIS_URL` and the test URLs built from them (dotenv-expand). Changing one line moves them all.
- `.env.example`: one root file documenting every variable with a safe default.
- The seed starts `packages/synthetic-data`: about 5 fictional customers in the brief's countries, 3 vendors, 30 items from fictional brands, opening stock, and 10 orders in different states. Every area base uses this set, and P-19 grows it.
- Getting started and `CONTRIBUTING.md` say `cp .env.example .env`, and troubleshooting covers "port already in use", "role does not exist" (another PostgreSQL answered) and Docker not running.
- Proved from a clean clone with nothing loaded in the shell, on the default ports and again with `POSTGRES_PORT=5433`.
- ADRs: Prisma with PostgreSQL; S3-compatible document storage.
- The local stack runs the `pgvector/pgvector` PostgreSQL image with the `pgvector` and `pg_trgm` extensions enabled, and Mailpit as the only place OrderPilot sends email in development and demos with an ADR, a pinned version and a traceability row (ADRs 0017 and 0018).

### P-10: Sign-in and sessions

Sessions, guards and a demo sign-in for all nine roles, with every sign-in and change audited.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-auth`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-9

Acceptance criteria:

- Credentials and tokens: argon2 password hashing; a JWT access token in an httpOnly, Secure, SameSite cookie; refresh-token rotation with reuse detection; CSRF protection.
- When a session does end, the API lets the user sign back in without losing their place, so the web app can keep unsaved form input (P-11).
- A demo sign-in (`DEMO_MODE`) offering the nine roles, with synthetic names.
- Guards: a users module, plus auth, CSRF and permissions guards. The permissions guard calls the role-permission matrix, which area 4 owns.
- Seeds: a user for every role, and the default matrix.
- Audit: every sign-in, sign-out and change.
- Integration tests: 401, 403 and validation cases.
- ADR: sessions and RBAC.

### P-11: The web shell

The web app's stack, tokens, plumbing, shell and first pages, within the bundle budget.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-web-shell`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-7

Acceptance criteria:

- The stack: Vite, React 19, TypeScript and Tailwind v4, with shadcn/ui set up by its Vite guide.
- Design tokens: a warm neutral base with a deep jade accent; light and dark themes; an 8-pt spacing grid; radius and motion values; the Geist font, with tabular numbers.
- App plumbing: React Router with route guards; an `ApiClient` class; TanStack Query; a minimal Zustand store; react-i18next (English, with no hard-coded strings); React Hook Form with zod.
- When a session ends, unsaved form input is kept, and the user signs back in and carries on where they were.
- The shell: a sidebar for each role; breadcrumbs; a command palette; a theme switch; the demo role switcher; notifications and a user menu.
- Pages: the login page, plain for now; settings; a "planned" page for each area; error pages.
- Assets: a theme script that stops the wrong theme flashing, and an OrderPilot favicon.
- The bundle budget (initial JS 250 KB gzip or less, 3D excluded) joins the verify job, and components have tests with Testing Library.
- UI sources while the repository is public: shadcn/ui; Magic UI (free); React Bits (free, `@react-bits`); ReUI's free components, only if they install without the licence key.
- ADRs: the web stack; i18n with English first; CSP and inline styles.

### P-12: Common components

The shared table, page states, badges and small pieces every area's screens use.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/platform-web-components`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-11

Acceptance criteria:

- Data and layout: a data table with server-side paging, sorting, filtering and column visibility, one quick search, saved filters, column settings, and CSV and Excel export; the page header and section cards.
- The operation log at the foot of each detail page: time, user, IP and what changed, built with F-2.
- Every state: loading skeleton, empty with a next action, error with retry and a trace id, partial, and permission denied.
- Badges: "Mock", "Mock AI", "Synthetic demo data", status, and classification.
- Small pieces, with tests: a masked value with "why is this hidden"; a confidence badge that says "Requires approval"; an audit link; relative time; a copy button; the planned page.

### P-13: Docker images and the IaC scan

Non-root images for the API, the web app and the mocks, scanned in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices, M6 deploy and monitor
- **Branch:** `ci/docker`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-8, P-11

Acceptance criteria:

- Images: multi-stage, running as non-root, with health checks; one for the API (with a worker entry); one for the web app (nginx with security headers and an SPA fallback); a generic one for the mock services.
- Compose: `api`, `worker` and `web` services, each waiting on its dependencies' health checks; `.dockerignore`; a samples override (a throwaway stack that only this machine can reach, for trying a client sample, deleted afterwards).
- CI: "Docker images" builds every image, then a Trivy image scan fails on fixable HIGH or CRITICAL findings; "IaC and Dockerfile scan" runs Trivy config. Both become required.
- ADR: Docker and the deployment target.

### P-14: End-to-end smoke

A signed-in smoke test for every role, with accessibility checked, required in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `test/e2e-smoke`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-10, P-11, P-13

Acceptance criteria:

- Playwright with axe, plus helpers for the demo session and the layout.
- A smoke test that signs in as each role, opens the shell and signs out, with WCAG 2.2 AA checked on every page.
- The CI job "End-to-end smoke" runs it against the compose stack, uploads the report and shows the service logs on failure. It becomes required.

### P-15: Events, queues and live updates

Typed domain events, a worker process and live updates in the web app.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-events`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9

Acceptance criteria:

- Events: a typed domain event bus, with a transactional outbox and idempotency keys.
- Workers: a BullMQ worker process.
- Live updates: an SSE stream to the web app, and a hook that listens to it.
- ADR: jobs, events and realtime.

### P-16: Diagrams as code

Mermaid sources rendered to SVG and checked in CI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `docs/diagrams`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9

Acceptance criteria:

- The pipeline: Mermaid sources rendered to SVG by `scripts/build-diagrams.mjs` (using Playwright's Chromium), with `diagrams:check` in CI.
- C4 context and containers.
- The sales flow and the purchase flow, showing who does what.
- The PO-to-approval sequence.
- The data model, generated from `schema.prisma`.
- Data flow, with trust boundaries and GRS controls.
- Deployment, local and on AWS.

### P-17: The AI gateway

One gateway over the AI providers, with usage tracking, a prompt-injection defence and a destination check.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-ai-gateway`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-8

Acceptance criteria:

- `LlmGateway` with three providers: mock (the default, deterministic, and works offline); OpenAI-compatible (a base URL, a key and a model, so Groq, Gemini's OpenAI-compatible endpoint, OpenRouter, NVIDIA NIM and Ollama all work by configuration alone); and optional Bedrock.
- Calls: structured output validated with zod, with retries; page images for vision models (Groq's `qwen/qwen3.8-27b` takes up to 3 images a request).
- Usage tracking: `AiUsageTracker` and `AiUsageRecord` log tokens, model, latency, estimated cost, feature, user, document and outcome, plus the data the web app needs to show its "Mock AI" badge.
- Prompt-injection defence: documents are treated as data; the model only returns fields; no model output triggers an action.
- A destination check: area 4's policy decides what data may go to which provider. The default is synthetic data only.
- Keys: Richie adds `GROQ_API_KEY` and `GEMINI_API_KEY` to the root `.env` himself.
- ADR: the AI gateway and the person in the loop.
- The Vercel AI SDK sits under `LlmGateway`, and the gateway keeps cost tracking and the data-to-AI policy with an ADR, a pinned version and a traceability row.

### P-18: Document intake and storage

A safe upload API, text and image extraction, the start of area 1's order data, and the upload screen.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-document-intake`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-9, P-17

Acceptance criteria:

- Upload API: accepts PDF, PNG, JPEG, XLSX and CSV; size limits, type sniffing and a zip-bomb guard; nothing executable; stored through P-9's storage service.
- Processing: PDF text extraction (pdfjs-dist) plus page images for the vision models; duplicate detection by content hash.
- Data model: the start of area 1's order data: orders, order lines, documents, and field values with confidence and provenance. Status stays in area 2.
- UI: an upload screen with drag and drop, and a documents list.
- Queue: a job that marks each document "awaiting AI" until the extraction stories.

### P-19: Mock Navision and synthetic master data

An OData-style mock of Navision and the synthetic master data behind it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-mock-navision`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-5

Acceptance criteria:

- `services/mock-navision`: an OData-style API with paging and `$filter`, behind an API key, for Items, Customers, Vendors, PriceLists and StockLevels, and for SalesOrders, PurchaseOrders and Receipts.
- `packages/synthetic-data`: a seeded random generator; a Spectra-like catalogue of fictional brands' IT, surveillance and accessory products, with part numbers; customers in India, Sri Lanka, Bangladesh, Pakistan and the UAE; vendors, stock, and USD prices.
- Customers and vendors in one list of business partners, each with a type and a price level, for the master-data screens and the price checks.
- Opening stock and opening balances (receivables and payables), growing the set P-9 starts.
- The mock speaks OData-style JSON with Navision's names in camelCase, as `docs/research/domain-notes.md` lists them.
- Realism: document numbering and statuses from Richie's notes when present.
- Tests, a compose service, `docs/api/mock-systems.md`, and a "Mock" label wherever it's used.
- ADR: mock external systems.

### P-20: The connector framework and the Navision adapter

A connector framework, and the adapter that makes a stock lookup work end to end.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-connectors`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-19

Acceptance criteria:

- The framework: a `SystemConnector` interface over named record kinds (items, customers, vendors, price lists, stock levels and mail messages).
- The framework: a factory (credentials only from the environment); a health probe and a retry policy with backoff; an HTTP JSON client with timeouts; data minimisation and an offline connector; the `Connector` model and a connectors page.
- The Navision adapter, so a stock lookup works end to end, with contract tests against the mock.
- ADR: hub-and-spoke integration.

### P-21: Synthetic documents

Generated PDFs with planted mistakes and ground truth, for the demo and the accuracy harness.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Branch:** `feat/area1-synthetic-documents`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-19

Acceptance criteria:

- `packages/synthetic-documents` generates PDFs from the synthetic master data: POs in at least four customer layouts; PIs, invoices, packing lists and AWB/BL; scanned-looking variants (rotated and noisy).
- Planted mistakes: quantity, price, PO reference, part number and changed bank details.
- Ground truth: a JSON file for every document, for the accuracy harness.
- Delivery: a CLI (`pnpm docs:generate`), with a set copied to `apps/web/public/demo-documents/` for demo uploads, not a folder called `samples`.

### P-22: The design system with the Pro kits

The licensed kits, set up once Richie says the repository is private and the official keys are in `apps/web/.env.local`, and Richie's own pages upgraded with them.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-design-system`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-11, P-12
- **Condition:** Only once Richie says the repository is private and official keys are in `apps/web/.env.local` (rule 8 of prompt 001, confirmed in prompt 002, section 7). Until he says, free kits only.

Acceptance criteria:

- Registries in `apps/web/components.json`: `@reactbits-starter`, `@reactbits-pro`, `@reui` and `@magicui`, with the licence keys sent as bearer headers from the environment.
- The keys stay in `apps/web/.env.local` as `REUI_LICENSE_KEY` and `REACTBITS_LICENSE_KEY`, and `components.json` refers to them only as `${...}`. No key is ever written into a file, commit or message.
- Pro parts stay in Richie's own pages: landing, sign-in, the app shell and the 3D view. The four areas' screens use the free kits unless Richie confirms a team licence.
- Each source verified with a test install, and exact errors reported.
- Tools: the React Bits skill read in full before any item is used; the shadcn MCP; ReUI's MCP server, with its token kept out of Git.
- `docs/design/reactbits-usage.md`: a plan for every page, saying which React Bits, ReUI and Magic UI items it uses, and why; 20 or more distinct items across the app; at least one item on every page; Pro blocks on landing and login; Application UI wherever it matches; only subtle items on dense work screens.
- `docs/design/design-system.md`.
- `CONTRIBUTING.md`: teammates never need the keys to run or build, because added components are code in the repository. Adding a new Pro component goes through Richie.
- Login and landing are upgraded with Pro blocks, then the app shell and the 3D view. Every item is adapted to the tokens, one component per file, with a header comment stating its origin.
- ADR: component registries, and why licensed code needs a private repository.

### P-23: The 3D order constellation

A live 3D view of orders moving between the six teams, on landing, login and as an operations view.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 13 points
- **Requirements:** M4 best practices
- **Branch:** `feat/area1-order-constellation`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-11, P-15

Acceptance criteria:

- The concept: the OrderPilot core, in faceted glass with an emissive inner light; around it, six team stations (Product Managers, Approver, Support, Warehouse, Finance and Logistics), plus Navision and the mailbox; documents travel as glowing packets along arcs while an order moves; status colours (on time, waiting, exception) come from real workflow events over SSE.
- It appears on landing and login, and as a live operations view.
- Assets: parametric Blender Python scripts in `assets-src/3d/`, with PBR materials, bevels and clean topology; run headless with `blender -b -P`; exported to GLB and quantised with glTF Transform, with no WebAssembly decoders; 1.5 MB or less in total.
- Rendering: React Three Fiber, drei and postprocessing; ACES filmic tone mapping, a studio environment and soft shadows; bloom, a subtle depth of field and a vignette; spring motion and a slow cinematic camera that the user can take over; hover tooltips, and clicking a node to navigate; React Bits overlays for labels.
- Performance and access: a lazy chunk, DPR clamped to [1, 2], and adaptive quality; pauses when off-screen or when the tab is hidden; a still frame for reduced motion, and a fallback image without WebGL; a keyboard-usable list beside the canvas; 60 fps on a mid-range laptop, reported honestly.
- ADRs: 3D assets without WebAssembly decoders; the constellation scene.

### P-24: Cloud deployment

The app live on a Lightsail server over HTTPS, deployed on each merge to `main`, with roll-back and backups.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices, M6 deploy and monitor
- **Branch:** `feat/platform-deploy`
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-13
- **Condition:** Only once Richie confirms step 8 of his guide.

Acceptance criteria:

- From Richie: an Amazon Lightsail server `orderpilot-prod` in Singapore (Ubuntu 24.04 LTS, 4 GB memory, a static IP, and a firewall open on 22, 80 and 443); the path of its SSH key on his PC, and its domain (an `sslip.io` name made from the static IP); a GitHub environment `production`, limited to `main`, holding `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_DOMAIN`.
- `infra/deploy/`: a server bootstrap run over SSH (Docker, the host firewall on 22, 80 and 443, fail2ban, swap, and automatic security updates).
- `infra/deploy/`: the app in `/opt/orderpilot`, with its own `.env` created there with generated secrets that are never printed. Richie adds the AI keys to it himself.
- `infra/deploy/`: Caddy for HTTPS, with the certificate for `DEPLOY_DOMAIN`; `docker-compose.prod.yml`, with no development ports; nightly PostgreSQL and MinIO backups, keeping seven days.
- `deploy.yml`, on each merge to `main`, after CI: builds the images and pushes them to GHCR, keeping only the latest five versions of each; SSHes to the server and pulls them, logging in to GHCR with the workflow's own short-lived token, so the server holds no GitHub credential; runs the migrations; checks health, and rolls back to the previous images on failure.
- `docs/deploy.md`: deploy, roll back, rotate secrets, read logs, restore a backup, and shut everything down after the module.
- The README gets the live demo link and a deployment table.
- A DAST job: an OWASP ZAP baseline scan of the live URL, weekly and on demand, with its report kept.
- ADR: the deployment.

### P-25: Slides as code

A Marp deck for the Week 5 proposal, built and checked in CI.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `docs/slides`
- **Planned for:** Sprint 04 (W5)
- **Depends on:** P-16

Acceptance criteria:

- A Marp deck for the Week 5 proposal: 12 to 14 slides, one idea each, themed with the app's tokens, using real screenshots and diagrams, with speaker notes.
- `pnpm slides:build` exports PDF, HTML and PPTX.
- `slides:check` runs in CI.

### P-26: Generated API hooks and mocks

orval generates typed TanStack Query hooks and MSW mocks from the API's OpenAPI spec, so every area base starts from the same typed client.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-orval`
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-8, P-11

Acceptance criteria:

- The API exports its OpenAPI spec to a file with no database running.
- orval, at an exact pinned version, generates typed TanStack Query hooks and MSW mocks from that file, through the web app's `ApiClient`.
- A CI step fails when the generated code is out of date.
- Every area base uses the generated hooks and mocks.
- An ADR (0019), a pinned version and a traceability row.

### P-27: Web shell polish

What P-11 left out because no teammate needs it in its first week.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Branch:** `feat/platform-web-polish`
- **Planned for:** Sprint 03 (W4)
- **Depends on:** P-11

Acceptance criteria:

- Unsaved form input also survives a page reload, through one small draft helper that forms can opt into. P-11 keeps it only across an ended session.
- A phone-width pass: screenshots at 390 px wide, light and dark, and the fixes they show. The sidebar already becomes a sheet, but spacing has not been reviewed on a phone.
- LCP and a Lighthouse run on the production build, with the figures recorded next to the screenshots.
- A collapsible sidebar that remembers its state, and a list of keyboard shortcuts.
- The refresh timer that runs a minute before the access token ends has a test with fake timers.

## Epic A: Document intake and AI extraction

Email or upload; classification; extraction with a confidence score and a source link per field; layout mappings that AI proposes and a person approves.

### A-1: Classification

AI tells the document types apart, for the sales pilot's PO upload.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-17, P-18

Acceptance criteria:

- AI classification tells document types apart on upload.
- It runs through the AI gateway, and the result stays a draft until a person confirms it.

### A-2: Extraction with confidence and provenance

AI reads the fields from POs, PIs, invoices and packing lists, and every field shows how sure it is and where it came from.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-1

Acceptance criteria:

- AI extraction reads fields from POs, PIs, invoices and packing lists, with confidence scores and human review.
- Every extracted field keeps its confidence and source, with a source link per field.
- AI output is a draft until a person confirms it.

### A-3: Layout mapping, proposed by AI and approved by a person

A new customer layout is mapped by AI and approved by a person (E2E #2).

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-2

Acceptance criteria:

- AI proposes a mapping for a new layout, and a person approves it.
- E2E #2 passes: a new layout is mapped by AI and approved by a person.

### A-4: Learning from corrections, one layout at a time

A person's corrections improve extraction, one layout at a time.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** A-3

Acceptance criteria:

- A person's corrections feed back into extraction, one layout at a time.

### A-5: Email intake through a mock mailbox with signed webhooks

Documents arrive by email as well as by upload, through a mock mailbox.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-18

Acceptance criteria:

- Email intake runs through a mock mailbox with signed webhooks.
- No real customer email is read or sent.

## Epic B: Master data and Navision

Items, customers, vendors, prices and stock behind a connector; any write-back needs a preview and an approval.

### B-1: Duplicate-PO protection

The same PO never creates a second order.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** P-18

Acceptance criteria:

- No duplicate orders: a repeated PO is caught.

### B-2: A Navision-ready import file

Confirmed data leaves as a file Navision can import, beside Navision and never instead of it.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** P-20

Acceptance criteria:

- A Navision-ready import file is produced from data a person has confirmed.
- Any write-back needs a preview and an approval, and nothing posts automatically.

### B-3: The template engine for PIs, invoices, packing lists and Excel

One engine for every generated document, used by areas 2 and 3.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** P-18

Acceptance criteria:

- The template engine produces PIs, invoices, packing lists and Excel.
- Areas 2 and 3 use it.
- React-PDF and ExcelJS render the template engine's PDF and Excel output with an ADR, a pinned version and a traceability row.

### B-4: QR codes on generated documents and carton labels

QR codes for the warehouse to scan.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M4 best practices
- **Depends on:** B-3

Acceptance criteria:

- Generated documents and carton labels carry QR codes for the warehouse to scan.

## Epic C: Order workflows and approvals

A state machine; tasks for each role; SPR approval within limits; the payment gate; reminders and escalations; generated PIs, invoices and packing lists.

### C-1: Area 2 base, the workflow module

Azri's head start: the models, contracts, screens and test skeletons, never the area's core logic.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Models: workflow definitions, instances, tasks, events and notifications.
- OrderPilot's own numbers for its records, like `SPR-20261102-0001`, beside Navision's.
- Payment confirmation records the payment type, and prepayment drives the payment gate.
- Configurable fields and default values for each document type, as configuration, not code.
- The SPR pre-fill is a suggestion from stock levels that a person approves.
- Contracts, with routes returning typed mock data in Swagger.
- Screens wired to those routes, covering every state: each role's task inbox; an order's steps and timeline; the SPR approval page (approve or reject, with a comment); reminders.
- To-do tests, as `it.todo` with the key cases named: transitions, SPR limits, the payment gate, reminders and escalations, and retries with idempotency.
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Azri: his state machine, which he writes again himself as his first story, so it stays his work; Spectra's sales and purchase flows, the SPR rules, the payment gate and the SLA logic.
- Azri's review is requested on the pull request once he is a collaborator, and Richie is told when it merges, so he can hand it over.

### C-2: The order state machine for the sales flow

Azri writes his own state machine, with the sales flow's states and transitions, so that order status lives in one place and stays his work.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- Azri writes the state machine himself, as his first story, so that it stays his work (C-1 leaves it to him).
- Its states and transitions follow the sales flow: the PO arrives; stock is checked and an SPR raised when needed; Support generates the PI; the customer pays; the warehouse packs; the invoice and packing list are made; the goods go to the forwarder; the customer gets the shipping details; the AWB/BL and import permit are followed up.
- Where they meet, its states map to Navision's Sales Header Status (Open, Released, Pending Approval, Pending Prepayment), as an assumption to confirm at the briefing call.
- Order status lives only in this state machine. Other areas read it or send events, and never set status themselves.
- Each transition names the role that may make it, and area 4's policy is called on the server before it happens.
- The payment gate guards packing: with the prepayment type, packing waits for Finance's confirmation.
- Area 3's checks report pass or fail, and a failure holds the order rather than moving it on.
- Every transition is a domain event with who, when, and the state before and after, for the tracker and the audit trail.
- An illegal transition is refused with the one error envelope, and audited.
- Unit tests cover every legal and every illegal transition, replacing C-1's `it.todo` cases for transitions, and all of them pass.
- The states and transitions are written down in area 2's guide.

### C-3: SPR approval within limits

An SPR goes to an approver who may decide it within their limit, set up in the shape of Navision's Approval User Setup.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- The approval setup has the shape of Navision's Approval User Setup: user, approver, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, and a substitute.
- Approvers, limits and delegation are configuration, not code, until Spectra confirms them.
- An approver approves or rejects an SPR within their limit, with a comment, on C-1's SPR approval page.
- An SPR above the approver's limit goes on to an approver whose limit covers it, or one with an unlimited approval, and is never approved below it.
- While an approver is away, their substitute receives the SPR.
- Area 4's policy is called on the server for each decision, and enforces no self-approval: whoever raised an SPR never approves it.
- The AI may pre-fill an SPR, but only a person approves it, and every decision is audited.
- Tests cover approval within the limit, above it and exactly at it, unlimited approvers, a substitute, and a refused self-approval, replacing C-1's `it.todo` cases for SPR limits.

### C-4: Reminders and escalations

A task that waits too long reminds its owner, then escalates, so that no follow-up goes overdue unseen.

- **Area:** `area: 2 order workflows and approvals`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** C-1

Acceptance criteria:

- Each task type has a due time from configurable SLA settings, not code.
- A reminder goes to the task's owner before the due time, and an escalation goes to whoever the configuration names once the task is overdue.
- Reminders and escalations run as queued jobs with idempotency keys, so a retried job never sends one twice.
- Each reminder and escalation is an in-app notification, and a workflow event the tracker uses for its overdue flag (D-4).
- A reminder to a customer or a vendor is a draft that a person sends, never sent on its own.
- Every overdue follow-up is visible.
- The reminder in E2E #1, the sales pilot, comes from this story.
- Tests cover a reminder before the due time, an escalation after it, a task finished in time getting neither, and a retried job sending once, replacing C-1's `it.todo` cases for reminders, escalations and retries.

## Epic D: Checks, the tracker and insights

Documents checked against each other with tolerances; an exceptions queue; one tracker with every order's trail; Spectra's five measures as KPIs.

### D-1: Area 3 base, checks and the tracker

Iok Teck's head start: the models, contracts, screens and test skeletons, never the area's core logic.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- The checks module: a check-rule Strategy interface; check-result and exception contracts; an empty exceptions model.
- Contracts, with routes returning typed mock data in Swagger.
- Screens wired to those routes, covering every state: the order tracker (status, owner, overdue flags); an order's detail timeline; the exceptions queue; a KPI dashboard of Spectra's five measures.
- An order's page in the tracker shows each step and its effect, such as "payment confirmed: packing released". Money postings stay in Navision.
- To-do tests, as `it.todo` with the key cases named: the MVP mismatch (the packing list's quantity against the PO), tolerances, and the KPI formulas.
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Iok Teck: every check and its tolerance, the exceptions flow, the tracker's logic and the KPIs.
- Iok Teck's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.

### D-2: The packing-list quantity check against the PO

The MVP mismatch: a packing list whose quantity differs from the PO is flagged, and the result goes to area 2.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- A check rule on D-1's Strategy interface compares each packing-list line's quantity with the matching PO line.
- Lines match on the item's Navision number, never on its name. A look-alike name is shown as a possible match.
- A difference outside the tolerance fails the check. The tolerance is configuration, and zero until Spectra says otherwise.
- The result, pass or fail with each differing line, is reported to area 2, which decides what happens to the order.
- A failure raises an exception in the exceptions queue (D-3), linked to both documents.
- It is a fixed rule, not AI. The AI may explain the exception, but never decides it.
- Every seeded quantity mismatch in the synthetic documents is flagged.
- Tests cover equal quantities, a short and an over quantity, a missing line, an extra line and the tolerance's edge, replacing D-1's `it.todo` cases for the MVP mismatch and tolerances.

### D-3: The exceptions queue flow

Exceptions are worked from one queue: assigned, explained, and resolved or waived, with every step recorded.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- Each exception gets OrderPilot's own number, like `EXC-20261102-0001`.
- An exception moves through its states (a first proposal: open, assigned, resolved and waived), and each step records who made it and when.
- Each exception has an owner and a due time, and an overdue one is flagged.
- Resolving or waiving an exception needs a reason, and every step is audited.
- Resolving an exception reports pass to area 2, so that the order can move on.
- D-1's queue screen filters by type, owner, state and age, with the common data table's quick search and saved filters (P-12).
- An AI summary may explain an exception, labelled as AI, and the logs stay the source of truth.
- Tests cover each state change, a change refused for want of a reason, and the overdue flag.

### D-4: The tracker's status, owner and overdue flags from workflow events

One tracker shows every order's status, owner and overdue flags, fed by area 2's workflow events and never set by hand.

- **Area:** `area: 3 checks tracker and insights`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** D-1

Acceptance criteria:

- The tracker takes each order's status from area 2's workflow events. It never stores or sets a status of its own.
- Each order shows its current step, the role and the person who hold it, and how long it has waited.
- An order or a follow-up past its due time is flagged overdue, and every overdue follow-up is visible.
- An order's page shows each step and its effect, such as "payment confirmed: packing released". Money postings stay in Navision.
- Until P-15's event bus exists, it works from the typed events in the order and event contract (P-7).
- It filters by status, owner, area and overdue, with the common data table (P-12).
- The overdue count feeds the KPI dashboard's overdue-orders measure.
- Tests cover a status change from an event, a change of owner, the overdue boundary, and the same event received twice.

## Epic E: AI with a person in the loop

Extraction, mismatch explanations, and drafts that a person sends.

### E-1: The review screen, with source highlighting

A person confirms the uncertain fields, with each one shown on the source document.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** A-2

Acceptance criteria:

- A person confirms the uncertain fields on the review screen.
- Each field's source is highlighted on the document.
- AI confidence is shown with "Requires approval".

### E-2: The accuracy harness, with a 95% target and a comparison of models

Extraction accuracy measured against the synthetic documents' ground truth.

- **Area:** `area: 1 document AI and integration`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M4 best practices
- **Depends on:** A-2, P-21

Acceptance criteria:

- The harness measures extraction accuracy on the synthetic test set, against a target of 95% or more.
- It compares models.
- promptfoo runs the accuracy set in CI with an ADR, a pinned version and a traceability row.

### E-3: Prompt-injection tests

Tests that prove a hostile document cannot steer the AI.

- **Area:** `area: 1 document AI and integration`
- **Priority:** should
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-17

Acceptance criteria:

- Tests show that documents are treated as data, the model only returns fields, and no model output triggers an action.
- promptfoo runs the prompt-injection tests in CI with an ADR, a pinned version and a traceability row.

### E-4: Passkeys to confirm risky approvals

A passkey confirms a risky approval, with area 4's policy deciding when.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Depends on:** P-10, F-1

Acceptance criteria:

- A passkey confirms a risky approval.
- Area 4's policy decides when one is needed.

### E-5: A first-run guided tour for each role

A short tour of the menu the first time each role signs in, which also walks the demo.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 3 points
- **Requirements:** M1 design thinking, M4 best practices
- **Depends on:** P-11

Acceptance criteria:

- A first-run tour of the menu for each of the nine roles, showing that role's own tasks.
- It can be skipped, and restarted from the user menu.
- It meets WCAG 2.2 AA: full keyboard use, focus kept in place, and reduced motion respected.
- Its text comes from react-i18next, with no hard-coded strings.
- It is in our own design and words, copied from no other product.
- It helps the demo: the tour for each role follows the sales pilot.

### E-6: An "Ask OrderPilot" help panel that answers from our docs

A help panel that answers questions from OrderPilot's own docs, labelled as AI-generated and for reference only.

- **Area:** `area: 1 document AI and integration`
- **Priority:** could
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M3 AI-assisted coding
- **Depends on:** P-11, P-17

Acceptance criteria:

- The panel answers from OrderPilot's own docs only, and links the pages it used.
- Every answer is labelled as AI-generated and for reference only.
- It goes through the AI gateway (P-17), with the mock provider by default, and each answer is tracked like any other AI call.
- It never acts: it cannot approve, change data or call another endpoint.
- Questions and docs are treated as data, and the prompt-injection tests cover it (E-3).
- Area 4's policy decides which provider may receive a question, and no business data goes with it.

## Epic F: Financial controls and governance

No self-approval; approval limits; bank-detail change control; masking of bank details and prices by role; a tamper-evident audit trail.

### F-1: Area 4 base, access policy and masking

Angelyn's head start on policy and masking: the mechanism and contracts, never the real rules.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Policy and masking: a role-permission matrix screen; the masking mechanism, with a neutral sample rule; classification contracts; the contract for what data may go to which AI provider; how a refusal looks.
- Role permissions plus a data scope, such as a Product Manager seeing only their brands' orders.
- A role's permissions can be copied to another role, and users are disabled, never deleted.
- Payment confirmation records the payment type, for the policy to use.
- Contracts, with routes returning typed mock data in Swagger, and screens covering every state.
- To-do tests, as `it.todo` with the key cases named: approval limits; no self-approval; the bank-detail hold; masking for each role; a direct API call being refused (E2E #3).
- The "What the base gives you" and "What's yours to build" sections of the guide are filled in.
- Left to Angelyn: the real policy, limits, segregation-of-duties rules, the bank-detail control and the masking rules.
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.

### F-2: Area 4 base, the audit viewer

The audit log viewer over the real hash chain.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-9, P-10, P-11, P-12

Acceptance criteria:

- The audit log viewer over the real hash chain, with filters and a chain check.
- To-do tests, as `it.todo`, for export and retention.
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.

### F-3: The authorisation policy with approval limits

Area 4's policy decides on the server who may do what, up to which amount, and every endpoint calls it.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- One policy, called on the server by every endpoint that acts. Hiding a button is never the control.
- Role permissions plus a data scope, on F-1's matrix: for example, a Product Manager sees only their brands' orders.
- Approval limits in the shape of Navision's Approval User Setup (approver, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, substitute), the same shape area 2's SPR approval uses (C-3).
- Limits and approvers are configuration until Spectra confirms them.
- An action above the actor's limit is refused, the way F-1 shows a refusal.
- Every refusal is audited: who, what, when and why.
- A direct API call without the permission is refused (E2E #3).
- Tests cover each role's allowed and refused actions, the data scope, each limit's edge and unlimited approvers, replacing F-1's `it.todo` cases for approval limits.

### F-4: No self-approval and segregation of duties

Nobody approves their own request, and the duties that must stay apart stay apart, on the server.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- Whoever raised a request never approves it, whatever their role or limit.
- A substitute who raised the request is refused too.
- `SYSTEM_ADMIN` configures the platform, and never approves, posts or pays.
- The duties to keep apart are configuration. They start with: raising and approving an SPR; confirming a payment and clearing a payment hold; changing a vendor's bank details and approving a payment to that vendor.
- Every refusal is audited, and shown the way F-1 shows a refusal.
- Segregation of duties holds in E2E #3.
- Tests cover self-approval through the API, through a substitute and after a change of role, replacing F-1's `it.todo` cases for no self-approval.

### F-5: The bank-detail hold

A vendor PI whose bank details differ from the vendor's bank account record holds the payment until Finance and a second approver clear it.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design, M4 best practices
- **Planned for:** Sprint 02 (W3)
- **Ready:** Ready to pull, at Ready on the board
- **Depends on:** F-1

Acceptance criteria:

- The bank details on a vendor PI are compared with the vendor's Vendor Bank Account record: Bank Account No., SWIFT Code and IBAN.
- Vendors match on their Navision number, never on their name.
- Any difference holds the payment, and nobody can pay the vendor while the hold is on.
- Only Finance and a second approver clear the hold: two different people, each with a reason, and neither of them the person who changed the details.
- Bank details are masked by role, with a reason, and the hold shows which field differs without showing the full number to a role that may not see it.
- Every hold, clearance and refusal is audited.
- The bank details are synthetic and obviously fake.
- It is the check behind E2E #4: a vendor PI with changed bank details holds the payment.
- Tests cover matching details, each field differing on its own, a clearance by one person alone, and a clearance by the person who made the change, replacing F-1's `it.todo` cases for the bank-detail hold.

## Epic G: Monitoring

Tracing, metrics, clickstream analytics, and the AI cost per document.

### G-1: Area 4 base, monitoring

The monitoring wiring and first screens, with the real dashboards left to Angelyn.

- **Area:** `area: 4 controls and monitoring`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M2 GRS by design, M6 deploy and monitor
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-10, P-11, P-12

Acceptance criteria:

- Wiring: OpenTelemetry for traces and metrics; `/metrics` with prom-client.
- Wiring: an `AnalyticsTracker` class (batching, consent, no PII), a clickstream endpoint and a `ClickstreamEvent` model.
- Screens: AI usage and cost, reading real records; observability and clickstream, on mock data with to-do tests.
- Left to Angelyn: the real dashboards, budgets and alerts, in Weeks 14 to 16 (Sprints 13 to 15).
- Angelyn's review is requested on the pull request once they are a collaborator, and Richie is told when it merges, so he can hand it over.
- Grafana's `otel-lgtm` image as an optional compose profile for traces, metrics and logs, and Sentry for errors in the web app and the API. Both stay off unless configured with an ADR, a pinned version and a traceability row (ADRs 0021 and 0022).

## Epic T: Team stories

The team's own work: owners and reviews, the client, the plan, the assessments and the handover.

### T-1: Owners, backups and reviews

Everyone on the repository and the board, every area with a backup owner, and `CODEOWNERS` filled in.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M5 team Git workflow
- **Planned for:** Sprint 01 (W2)
- **Depends on:** P-2

Acceptance criteria:

- Richie has given each teammate's GitHub username.
- Each teammate is invited with Write access and added to the board.
- Richie has named each area's backup owner.
- `CODEOWNERS` is filled so every path has at least two owners and nobody ever waits on their own approval: each area's paths go to its owner, its backup owner and Richie, and shared files go to Richie and the backup owners.
- Each teammate commits with their GitHub no-reply email (GitHub, Settings, Emails), never a school email.

### T-2: The briefing call with Spectra

The call with the client, with the priority questions sent ahead of it.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 2 points
- **Requirements:** M1 design thinking
- **Planned for:** Sprint 02 (W3)
- **Depends on:** P-3

Acceptance criteria:

- The briefing call with Spectra is held in Sprint 2.
- The priority questions in `docs/client/questions-for-client.md` are sent before the call.

### T-3: The project plan

The team's plan for the module.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M5 team Git workflow
- **Planned for:** Sprint 02 (W3)

Acceptance criteria:

- The project plan is done in Sprint 2.

### T-4: The UI prototype across the four areas

The Week 4 prototype of the sales pilot, across all four areas.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 8 points
- **Requirements:** M1 design thinking, M4 best practices
- **Planned for:** Sprint 03 (W4)

Acceptance criteria:

- The UI prototype across the four areas is done in Sprint 3.
- It follows the UI rules, and shows only synthetic data, labelled "Synthetic demo data".

### T-5: The proposal deck and presentation

The Week 5 proposal, worth 25%.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M1 design thinking, M2 GRS by design
- **Planned for:** Sprint 04 (W5)
- **Depends on:** P-25

Acceptance criteria:

- The proposal deck and presentation are ready in Sprint 4.
- The release is tagged `v0.1-proposal`, after a feature freeze.

### T-6: Design thinking

The team's design thinking, built on the starting points in `docs/design-thinking/`.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M1 design thinking
- **Planned for:** Sprint 02 (W3) and Sprint 03 (W4)
- **Depends on:** P-3

Acceptance criteria:

- Design thinking is done in Sprints 2 and 3, starting from P-3's `docs/design-thinking/`: the method, personas, journeys, how might we, hypotheses, and success metrics with a measurement protocol.

### T-7: GRS by design

The team's governance, risk and sustainability work, built on `docs/grs/grs-by-design.md`.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 5 points
- **Requirements:** M2 GRS by design
- **Planned for:** Sprint 03 (W4) and Sprint 04 (W5)
- **Depends on:** P-3

Acceptance criteria:

- GRS by design is done in Sprints 3 and 4, starting from P-3's `docs/grs/grs-by-design.md`: governance, the risk register and sustainability.
- Nothing claims the prototype is PDPA compliant.

### T-8: Preparing for the mock interview

Each member ready to explain their own code at the Week 7 mock job interview, worth 15% each.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M3 AI-assisted coding, M4 best practices
- **Planned for:** Sprint 05 (W6) and Sprint 06 (W7)
- **Depends on:** P-4

Acceptance criteria:

- Done in Sprints 5 and 6, ready for the Week 7 mock job interview.
- Each member can explain their own code, using what their area's guide says the owner explains.

### T-9: The handover

Each owner takes over their area, and the team moves to planning by tasks.

- **Area:** `area: team`
- **Priority:** must
- **Estimate:** 3 points
- **Requirements:** M5 team Git workflow
- **Depends on:** C-1, D-1, F-1, F-2, G-1
- **Condition:** When the base is done.

Acceptance criteria:

- Each owner takes over their area.
- Prompt 003 writes the rest of epics A to G's stories from the owners' planning notes.
- One approving review plus code-owner review is switched on, only on Richie's yes.
- The first sprint is planned by tasks.
