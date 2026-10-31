# Requirements traceability

Every feature traces to at least one of the six module requirements. Each row says where the feature lives and what proves it. Each story adds or updates its rows in its own pull request ([rule 4](../CLAUDE.md#rules-for-every-story)).

- **Status:** **Today** (merged on `main`), **On its way** (its pull request is open) or **Planned** (the story is not built yet).
- **Evidence** is what a reader can open or run: a file, a test, a check, a screenshot or a metric. For a planned row it says what the evidence will be.

## The six requirements

| #   | Requirement        | What it asks                                                                              |
| --- | ------------------ | ----------------------------------------------------------------------------------------- |
| M1  | Design thinking    | Start from what Spectra's staff and other stakeholders need, and set clear objectives     |
| M2  | GRS by design      | Governance, risk and sustainability designed in, and visible in the UI prototype          |
| M3  | AI-assisted coding | Use AI tools to build, responsibly, aware of where they help and where they fail          |
| M4  | Best practices     | Secure, fast and well-tested code                                                         |
| M5  | Team Git workflow  | Everyone's work merged through branches and pull requests                                 |
| M6  | Deploy and monitor | Run it in the cloud and watch it: observability, clickstream analytics and AI token usage |

## M1 Design thinking

| Feature or control                               | Where                                                                                | Evidence                                       | Story     | Status     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- | --------- | ---------- |
| The problem, stakeholders, pains and root cause  | [problem-statement.md](problem-statement.md)                                         | The document, checked against the brief        | P-3       | On its way |
| Assumptions and the questions that test them     | [assumptions.md](assumptions.md), [client questions](client/questions-for-client.md) | Each assumption names its question             | P-3       | On its way |
| Domain research: Navision and inventory patterns | [research/](research/README.md)                                                      | The domain notes, in our own words             | P-3       | On its way |
| Personas, journeys, how might we, hypotheses     | [design-thinking/](design-thinking/README.md)                                        | The documents; updated after the briefing call | P-3, T-6  | On its way |
| Success metrics and the measurement protocol     | [success-metrics.md](design-thinking/success-metrics.md)                             | Results table, manual against OrderPilot       | P-3       | On its way |
| The demo story                                   | [hero-journey.md](agile/hero-journey.md)                                             | E2E #1 to #4                                   | P-3, P-14 | On its way |
| The briefing call with Spectra                   | The questions' answers table                                                         | Answers recorded, assumptions updated          | T-2       | Planned    |
| The UI prototype across the four areas           | `apps/web`                                                                           | Screenshots in light and dark                  | T-4       | Planned    |

## M2 GRS by design

| Feature or control                                          | Where                                                            | Evidence                                                   | Story          | Status     |
| ----------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | -------------- | ---------- |
| Governance, the risk register and sustainability            | [grs-by-design.md](grs/grs-by-design.md)                         | The document; no PDPA compliance claim                     | P-3, T-7       | On its way |
| A clean repository with nothing from other statements       | [ADR 0002](adr/0002-a-clean-repository-for-ps11.md)              | The house scan on every pull request                       | P-1            | Today      |
| Synthetic data only, samples and AI tool folders ignored    | `.gitignore`, [CLAUDE.md data rules](../CLAUDE.md#data-rules)    | `git check-ignore` results in P-1's pull request           | P-1            | Today      |
| Trying a client sample safely                               | [data-formats.md](data-formats.md#trying-a-client-sample-safely) | The procedure and the sample log                           | P-3, P-5, P-13 | On its way |
| Authorisation enforced on the server, every refusal audited | `apps/api/src/modules/governance`, the permissions guard         | Integration tests with 401 and 403; E2E #3                 | P-10, F-1, F-3 | Planned    |
| No self-approval and segregation of duties                  | `governance`                                                     | Unit and integration tests; E2E #3                         | F-4            | Planned    |
| The bank-detail hold                                        | `governance`, `workflows`                                        | E2E #4                                                     | F-5            | Planned    |
| Masking of bank details and prices by role                  | `governance`, the masked value component                         | Tests for each role                                        | F-1, P-12      | Planned    |
| Tamper-evident audit trail                                  | `AuditEvent`, the audit writer, `audit`                          | Chain check tests; the append-only trigger refuses changes | P-9, F-2       | Planned    |
| A person approves every AI output that acts                 | The review screen, the gateway                                   | Tests that no model output triggers an action              | P-17, area 1   | Planned    |
| What data may go to which AI provider                       | `governance`, `LlmGateway`                                       | Destination check tests; mock by default                   | P-17, F-1      | Planned    |
| GRS visible in the UI                                       | The common components                                            | Badges, masked fields, audit links, "Requires approval"    | P-12           | Planned    |

## M3 AI-assisted coding

| Feature or control                                       | Where                                                                 | Evidence                                                                                                     | Story            | Status     |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- | ---------- |
| The AI usage log, one row per story                      | [ai-usage-log.md](ai/ai-usage-log.md)                                 | A row for each merged story                                                                                  | P-1, every story | Today      |
| Prompts kept                                             | [docs/ai/prompts/](ai/prompts/001-build-the-base.md)                  | [Prompt 001](ai/prompts/001-build-the-base.md) and [prompt 002](ai/prompts/002-finish-the-base-by-sunday.md) | P-1, P-2         | Today      |
| Rules for every teammate's AI tool, and a starter prompt | [AGENTS.md](../AGENTS.md)                                             | The file                                                                                                     | P-1              | Today      |
| No AI attribution                                        | `.claude/settings.json`, the house rules                              | The house scan over files and commits                                                                        | P-1              | Today      |
| Where AI is used, and where it is not                    | [problem-statement.md](problem-statement.md#1-the-brief-in-our-words) | The table                                                                                                    | P-3              | On its way |
| The AI gateway, with usage and cost per call             | `apps/api/src/modules/ai`                                             | Usage records; the "Mock AI" badge                                                                           | P-17             | Planned    |
| Extraction accuracy of 95% or more                       | The accuracy harness                                                  | The harness report against the ground truth                                                                  | P-21, area 1     | Planned    |

## M4 Best practices

| Feature or control                                             | Where                                                        | Evidence                                          | Story              | Status     |
| -------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | ------------------ | ---------- |
| Engineering, security, performance and testing standards       | [CLAUDE.md](../CLAUDE.md#4-engineering-standards)            | The file                                          | P-1                | Today      |
| How to report a vulnerability, and what we scan                | [SECURITY.md](../SECURITY.md)                                | Private vulnerability reporting is on             | P-1                | Today      |
| LF line endings and editor settings                            | `.gitattributes`, `.editorconfig`                            | `git ls-files --eol` in P-1's pull request        | P-1                | Today      |
| Assumed data formats, each to confirm                          | [data-formats.md](data-formats.md)                           | Navision's names, confirmed against samples later | P-3                | On its way |
| Strict TypeScript, lint with no warnings, formatting, hooks    | `packages/tsconfig`, `packages/eslint-config`, the Git hooks | `pnpm lint`, `pnpm typecheck`                     | P-5                | Planned    |
| Pinned versions and supply-chain settings                      | `package.json`, `pnpm-workspace.yaml`                        | Frozen install in CI                              | P-5                | Planned    |
| Verify, Semgrep, gitleaks and OSV in CI                        | `.github/workflows/`                                         | Required checks on every pull request             | P-6                | Planned    |
| The test plan and the failure matrix                           | `docs/agile/test-plan.md`                                    | The document                                      | P-6                | Planned    |
| API hardening: helmet, CORS, rate limiting, one error envelope | `apps/api`                                                   | Header tests; error envelope tests                | P-8                | Planned    |
| Sessions: argon2, rotation, CSRF                               | `apps/api/src/modules/auth`                                  | Integration tests                                 | P-10               | Planned    |
| The bundle budget and accessibility                            | `apps/web`, the end-to-end tests                             | Budget in the verify job; axe on every page       | P-11, P-14         | Planned    |
| Docker images and IaC scanned with Trivy                       | Dockerfiles, `docker-compose.yml`                            | Required checks                                   | P-13               | Planned    |
| Every seeded mismatch flagged                                  | `apps/api/src/modules/checks`                                | Tests against the planted mistakes                | D-2, area 3        | Planned    |
| 100% of workflow tests passing                                 | `apps/api/src/modules/workflows`                             | The workflow test run                             | C-2 to C-4, area 2 | Planned    |
| No duplicate orders                                            | `documents`, `orders`                                        | Duplicate-PO tests                                | P-18, area 1       | Planned    |
| A k6 smoke load test                                           | Not yet in a story                                           | The k6 report                                     | Not yet in a story | Planned    |

## M5 Team Git workflow

| Feature or control                                                               | Where                                                                                        | Evidence                                       | Story         | Status     |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------- | ---------- |
| The `Protect main` ruleset and repository settings                               | GitHub, [the build report's step 0](BUILD_REPORT.md#step-0)                                  | Read back with `gh api`                        | P-1           | Today      |
| One story, one branch, one pull request, Conventional Commits                    | [CLAUDE.md](../CLAUDE.md#9-git-and-ai-rules), [CONTRIBUTING.md](../CONTRIBUTING.md#workflow) | The pull request history                       | P-1           | Today      |
| The working agreement and the Definitions of Ready and Done                      | [docs/agile/](agile/README.md)                                                               | The documents                                  | P-1           | Today      |
| Issue forms, the pull request template, labels, `CODEOWNERS`, the ruleset mirror | [`.github/`](../.github/)                                                                    | The files; labels synced by script             | P-2           | Today      |
| The board (live once the setup script has run), milestones and backlog as code   | `scripts/github/`, [`docs/agile/backlog.md`](agile/backlog.md)                               | Idempotent script runs                         | P-2           | Today      |
| The sprint recorder and the sprint report                                        | `.github/workflows/sprint-recorder.yml`, `scripts/github/sprint-report.mjs`                  | Closed issues land in their sprint's milestone | P-2           | Today      |
| The wiki, published from `docs/wiki/`                                            | `docs/wiki/`                                                                                 | The published wiki                             | P-2           | Today      |
| Who owns which paths, shared files and reviewers                                 | [module-ownership.md](team/module-ownership.md)                                              | The document; `CODEOWNERS` filled at T-1       | P-4, T-1      | On its way |
| A guide for each area                                                            | [docs/team/](team/module-ownership.md#owners)                                                | The four guides                                | P-4           | On its way |
| Code owners and backup owners                                                    | [`.github/CODEOWNERS`](../.github/CODEOWNERS)                                                | Every path has two owners                      | T-1           | Planned    |
| A pre-push guard that refuses pushes to `main`                                   | The Git hooks                                                                                | A refused push, shown in P-5's pull request    | P-5           | Planned    |
| Release tags after a feature freeze                                              | `v0.1-proposal`, `v0.2-technical-review`, `v1.0-final`                                       | The tags on `main`                             | T-5 and later | Planned    |

## M6 Deploy and monitor

| Feature or control                                  | Where                                  | Evidence                                       | Story                    | Status  |
| --------------------------------------------------- | -------------------------------------- | ---------------------------------------------- | ------------------------ | ------- |
| Structured logs with correlation ids, health checks | `apps/api`                             | `/health`, `/health/live`, `/health/ready`     | P-8                      | Planned |
| The local stack                                     | `docker-compose.yml`                   | `docker compose up --build` from a clean clone | P-9, P-13                | Planned |
| AI token usage and cost per document                | `AiUsageRecord`, the AI usage screen   | Usage records and the screen                   | P-17, G-1                | Planned |
| Traces, metrics and `/metrics`                      | `apps/api/src/modules/monitoring`      | Traces and metrics from a run                  | G-1                      | Planned |
| Clickstream analytics with consent and no PII       | `AnalyticsTracker`, `ClickstreamEvent` | Tests; the clickstream screen                  | G-1                      | Planned |
| Cloud deployment in Singapore, with rollback        | `infra/deploy/`, `deploy.yml`          | The live URL; a rollback on a failed check     | P-24                     | Planned |
| OWASP ZAP against the live URL                      | The DAST job                           | The kept report                                | P-24                     | Planned |
| Dashboards, budgets and alerts                      | The monitoring screens                 | Screenshots and alert tests                    | Area 4, Sprints 13 to 15 | Planned |
| Spectra's five measures as KPIs                     | `insights`                             | The KPI dashboard, labelled lab estimates      | D-1, area 3              | Planned |
