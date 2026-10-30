# Prompt 001: Build the OrderPilot base

This repository holds **OrderPilot**, our product for Problem Statement #11, Spectra Innovations, in the IT2134 IT Innovation Project (SCCCI x NYP AI Innovation Challenge, AY2026 Semester 2).

- **A fresh start for #11 only.** Our lecturer asked for a clean repository. Nothing from any other problem statement appears here: no code, names, fields, strings, comments, data, documents, decisions, prompts, logs, screenshots or history.
- **Richie, the team lead, builds the base for every area.** You are building it with him. When it is done, each owner takes over their own area and the team works sprint by sprint, by tasks.
- **Every piece is merged the normal way:** one story, one issue, one branch, one pull request, green checks.
- **Kiro is only the IDE.** Don't use Kiro specs, steering or hooks.

## 1. Sources

- **This prompt** is the brief. In P-1 you write `CLAUDE.md` and `AGENTS.md` from it, and from then on they are the source of truth.
- **The earlier repository** is a read-only clone at `../orderpilot-base-reference`, checked out at commit `f6bb016`. Read it only for lessons:
  - how it solved CI, security headers, env loading, the 3D pipeline and Windows set-up (its `docs/BUILD_REPORT.md` lists the set-up lessons for Richie's machine);
  - #11's decisions: `docs/problem-statement.md`, `docs/ai/prompts/006-final-ps11-spectra.md`, `docs/ai/prompts/007-orderpilot-name-scope-and-contracts.md`, and sections 1 to 4 of `CLAUDE.md`.

  Write everything here fresh, for #11. Never copy files from it. Never edit, commit, fetch or push in that folder, and never add it as a remote. If it is missing or at another commit, stop and tell Richie.

- **Spectra's documents** never go into Git.
- **Richie's ERP notes.** Richie studied a third-party ERP and may add domain notes in his own words under `docs/research/`. Use them for realism: document types, fields, numbering and statuses. Never ask for, open, commit or send to an AI service any screenshot or data from that ERP.

## 2. The product (the brief every story serves)

**The client.** Spectra Innovations is a Singapore distributor, and master distributor for appointed brands, of IT products and computer peripherals. Its customers are in South Asia (India, Sri Lanka, Bangladesh, Pakistan) and the Middle East, and most of them pay before their goods ship. Its ERP is Microsoft Dynamics Navision.

**The problem.** Six groups handle every order by hand: Product Managers, the approver (Janet), Support, Warehouse, Finance and Logistics. Staff re-type data from POs, proforma invoices (PIs), invoices, packing lists and AWB/BL into Navision, and spend their time chasing approvals, payments and shipping papers.

**The two flows**, linked by the SPR (Sales Purchase Requisition):

- **Sales:**
  1. The customer's PO arrives.
  2. Stock is checked, and an SPR is raised when needed.
  3. Support generates a PI with the bank details.
  4. The customer pays.
  5. The warehouse packs.
  6. The invoice and packing list are made.
  7. The goods go to the forwarder.
  8. The customer gets the shipping details.
  9. The AWB/BL and import permit are followed up.
- **Purchase:**
  1. A Product Manager raises an SPR.
  2. The approver approves it.
  3. Support creates the vendor PO in Navision.
  4. The vendor's PI arrives with its bank details.
  5. A forwarder is arranged.
  6. The warehouse checks the goods against the invoice, packing list and AWB/BL.
  7. The goods are received into Navision.
  8. The customer is told.
  9. Finance pays the vendor on the due date.

**What we build.** OrderPilot is an AI-assisted order-automation layer **beside** Navision, never instead of it. Its tagline is **"AI reads, rules decide, people approve."**

- **Users:** Spectra's staff only, in one web app behind a login. Each role sees its own tasks.
- **Devices:** desktop first and responsive. The warehouse screens also work on a tablet, with touch targets of 44 px or more.
- **Not a shop:** customers and vendors never log in. They keep emailing documents, and staff send them the updates OrderPilot drafts.

**Roles:**

| Role              | Access                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `SYSTEM_ADMIN`    | Configures the platform; never approves, posts or pays                                                          |
| `PRODUCT_MANAGER` | Raises SPRs and follows their brands' orders and stock                                                          |
| `APPROVER`        | Approves or rejects SPRs and requests within their limit                                                        |
| `SUPPORT`         | Confirms documents, keeps orders current, generates PIs, invoices and packing lists, and sends customer updates |
| `WAREHOUSE`       | Checks goods against documents, then packs and releases them                                                    |
| `FINANCE`         | Confirms payments, pays vendors, and clears payment holds with a second approver                                |
| `LOGISTICS`       | Arranges forwarders, and follows shipment dates, AWB/BL and import permits                                      |
| `MANAGEMENT`      | Reads the tracker, dashboards and reports                                                                       |
| `AUDITOR`         | Reads the audit trail                                                                                           |

**Capabilities:**

- **A. Document intake and AI extraction:** email or upload; classification; extraction with a confidence score and a source link per field; layout mappings that AI proposes and a person approves.
- **B. Master data and Navision:** items, customers, vendors, prices and stock behind a connector; any write-back needs a preview and an approval.
- **C. Order workflows and approvals:** a state machine; tasks for each role; SPR approval within limits; the payment gate; reminders and escalations; generated PIs, invoices and packing lists.
- **D. Checks, the tracker and insights:** documents checked against each other with tolerances; an exceptions queue; one tracker with every order's trail; Spectra's five measures as KPIs.
- **E. AI with a person in the loop:** extraction, mismatch explanations, and drafts that a person sends.
- **F. Financial controls and governance:** no self-approval; approval limits; bank-detail change control; masking of bank details and prices by role; a tamper-evident audit trail.
- **G. Monitoring:** tracing, metrics, clickstream analytics, and the AI cost per document.

**MoSCoW:**

- **Must, for the Week 4 prototype and Week 5 proposal: the sales pilot.**
  - PO upload, with AI classification and extraction.
  - A person confirms the uncertain fields.
  - A stock lookup in mock Navision.
  - An SPR raised by a button and approved.
  - The tracker.
  - One mismatch: a packing list whose quantity differs from the PO.
  - The permission check, enforced on the server.
- **Should, by Week 13, in order:** the payment gate; a PI draft; full matching; AWB/BL and permit follow-ups; email intake with AI-drafted updates; more rules.
- **Phase 2, Weeks 8 to 12, in the Week 18 final:** the purchase flow, with the bank-detail check.
- **Out of scope:** replacing Navision, automatic postings, real payments, and real customer emails.

**The AI rules:**

- The AI reads, classifies, extracts, explains and drafts. It never approves, buys, posts, releases goods or pays: a person does, and that is audited.
- It never makes a purchase. It pre-fills an SPR or a vendor PO draft, and a person approves before anything happens.
- **Enter once, flows everywhere.** Data a person confirms feeds every team's task and the tracker. Writes to Navision and messages to customers wait for a person's OK.

**Where we use AI:**

| Task                                                     | Approach                                              |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Reading fields from POs, PIs, invoices and packing lists | AI extraction with confidence scores and human review |
| Telling document types apart                             | AI classification                                     |
| Comparing quantities, prices and PO references           | Fixed rules                                           |
| SPR routing and limits                                   | Workflow rules; a person approves                     |
| Releasing packing after payment                          | A rule plus Finance's confirmation                    |
| Explaining an exception                                  | An AI summary; the logs stay the source of truth      |
| Drafting customer or vendor emails                       | An AI draft; a person sends it                        |

**Data rules:**

- Synthetic data only, labelled "Synthetic demo data". Obviously fake bank details, no national ID numbers, and prices in USD.
- Mask bank details and prices by role, with a reason.
- Every extracted field keeps its confidence and source. AI output is a draft until a person confirms it.
- Match customers, vendors and items on their Navision numbers, never on names. A look-alike name is shown as a possible match.
- Open business rules are configuration until Spectra confirms them: the SPR trigger, the PI sequence, approvers and limits, and delegation.
- No Spectra document goes to a third-party AI without their written OK, in an approved region.

**Targets:**

- extraction accuracy of 95% or more on the synthetic test set;
- every seeded mismatch flagged;
- no duplicate orders;
- 100% of workflow tests passing;
- time and touches per order measured;
- every overdue follow-up visible.

Spectra's own five measures sit alongside these: order-processing time, manual touches per order, data-entry errors, approval turnaround and overdue orders.

**End-to-end tests:**

- **#1, the sales pilot:** upload, two fields confirmed, stock, SPR, a reminder, the mismatch, and the tracker.
- **#2, AI layout mapping:** a new layout is mapped by AI and approved by a person.
- **#3, refusals:** an unauthorised direct API call is refused, segregation of duties and masking hold, and every refusal is audited.
- **#4, the purchase flow:** a vendor PI with changed bank details holds the payment.

**The areas:**

| Area                                 | Owner    | Builds                                                                                                                  |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Document AI and integration       | Richie   | The whole AI pipeline, intake, documents and orders data, master data, connectors, the platform and the 3D scene        |
| 2. Order workflows and approvals     | Azri     | The workflows on his state machine, tasks, SPR approval, the payment gate, reminders and generated documents            |
| 3. Checks, tracker and insights      | Iok Teck | The checks engine, the exceptions queue, the tracker and the KPIs                                                       |
| 4. Controls, security and monitoring | Angelyn  | The authorisation policy, bank-detail control, masking, audit, data-to-AI rules, observability, clickstream and AI cost |

**How the areas connect:**

- Order status lives only in area 2's state machine.
- Area 3 reports pass or fail to area 2.
- Area 4's policy is enforced on the server, and endpoints call it.
- The AI pipeline stays whole in area 1.
- The team agrees the order and event contract together in Week 3.

**The module:**

| Week | Assessment                                              | Weight          |
| ---- | ------------------------------------------------------- | --------------- |
| 5    | Proposal                                                | 25%             |
| 7    | Mock job interview: each member explains their own code | 15%, individual |
| 13   | Technical review                                        | 25%             |
| 18   | Final                                                   | 35%             |

- 85% of the marks are individual, so ownership must be obvious.
- The six module requirements are M1 design thinking, M2 GRS by design, M3 AI-assisted coding, M4 best practices, M5 team Git workflow, and M6 deploy and monitor.
- Every feature traces to at least one of them.

## 3. Rules for every story

1. **One story, one issue, one branch, one pull request.**
   - Branch from the latest `main`.
   - The pull request closes its issue (`Closes #N`) and is merged with a merge commit once every required check is green.
   - The branch is then deleted and the story moves to Done.
2. **Names:** branches `feat/<area>-…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`. Conventional Commits, small commits.
3. **The pull request follows the template:**
   - what and why;
   - the acceptance criteria with evidence;
   - the real results of `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus `docker compose up --build` once it exists;
   - for UI changes, screenshots in light and dark from a Docker build of the branch, saved in `docs/design/screenshots/<area>/`.
4. **Each story brings its own pieces with it:**
   - its models and migration, tests, `.env.example` entries and `.http` request files;
   - an ADR when it makes a decision;
   - rows in the traceability matrix and `docs/architecture/patterns.md`;
   - one row in the AI usage log.
5. **No AI attribution anywhere.** No Co-Authored-By trailers for AI, no "Generated with" lines, and no AI emojis or session links in commits, pull requests, comments or docs. Richie has already placed `.claude/settings.json`, which turns attribution off; P-1 commits it as it is.
6. **No em dashes** in any file, commit, pull request or UI text. Use a hyphen, a colon or a new sentence. P-5 adds a check that enforces this.
7. **Data and secrets:**
   - Synthetic data only.
   - Licence keys live only in `apps/web/.env.local`, and AI keys only in the root `.env`. Richie puts them there himself.
   - Never print, echo or ask for a key in chat.
8. **While the repository is public,** add no React Bits Pro or ReUI Pro code: their licences need a private repository. Richie tells you when it is private. Then check that the ruleset is still active and the wiki still opens, update `SECURITY.md`, `docs/security/security-testing.md` and `.github/rulesets/main.json` for what changed, and do P-22 once he says the keys are in place.
9. **Ask Richie first** before anything destructive or irreversible, and before any change to this plan.
10. **Honesty:** run the commands and report their real results. If something cannot be done, say so and propose the nearest alternative.

## 4. Step 0, before the first pull request

1. **The ruleset.** Create **Protect main** on the default branch with `gh api`:
   - rules for deletion, non-fast-forward, and pull requests (0 approvals for now, stale reviews dismissed, review threads resolved, merge commits or squash);
   - a bypass for repository admins in pull request mode;
   - no required checks yet. Each story below adds its own.
2. **Settings:**
   - delete head branches after merge; allow only merge commits and squash; default workflow permissions read-only;
   - Dependabot alerts and security updates on;
   - while the repository is public, also secret scanning with push protection and private vulnerability reporting. These stop when it goes private, and our own gitleaks and Semgrep cover both cases;
   - Issues, Projects and the wiki on. If the wiki needs its first page made in the browser, ask Richie once.
3. **Docker:** if containers from other projects are running (`docker ps`), they hold the ports this repository needs. Ask Richie to stop them, and never remove them or their volumes.
4. **The first two issues:** create them by hand, for P-1 and P-2, so their pull requests have something to close. P-2's scripts adopt them by title.

## 5. Time: weekly sprints that never cap the work

- **One sprint is one week, Monday to Sunday.** Sprint 1 is 26 Oct to 1 Nov 2026 (the module's Week 2), and Sprint _n_ is module Week _n_ + 1. The milestones run from `Sprint 01 (W2)` to `Sprint 18 (W19)`.
- **Sprints are a rhythm, not a limit.** They set when we plan, review, reflect and report. Work never waits for a sprint. Whoever is free pulls the next ready story from the top of the backlog: Must, then Should, then Could, then continuous work.
- **Continuous work keeps every sprint busy:** tests, accessibility, performance, security fixes, docs, refactoring, research spikes and client feedback.
- **During the base,** work through the stories below in order, without waiting between them.
- **Record when work was done.** A story goes into the milestone of the week it was finished. P-2 automates this, and adds a sprint report for the end-of-day update.
- **At the end of each day you work,** add a short note to the current milestone: what merged and what is in progress.
- **Stop when the base is done** (sections 6 to 8), or when you are blocked.
- **If your context is compacted, or a new session picks this up,** re-read this prompt, work out where you are from the board, the open pull requests and `docs/BUILD_REPORT.md`, and carry on.

## 6. The platform base, in order

### Part 1: the team's way of working

**P-1 Ground rules** (`docs/ground-rules`)

- **Front matter:**
  - `README.md`: what OrderPilot is, its status, and links;
  - `CONTRIBUTING.md`: set-up, workflow and how to add a component;
  - `SECURITY.md`: how to report, and what we scan.
- **`AGENTS.md`, for every teammate's AI tool** (Kiro, Copilot, Cursor, ChatGPT):
  - never delete or overwrite anyone's work, because it has happened twice before;
  - write only in your own area;
  - no force pushes;
  - risky commands (`reset --hard`, `clean`, mass formatting) only after an explicit yes;
  - no AI tool folders committed;
  - no attribution, synthetic data only, and keys kept out of Git;
  - the path from a story to `main`;
  - a starter prompt to paste at the start of each session.
- **`CLAUDE.md`:** the product brief from section 2, then:
  - the stack and repository layout;
  - the engineering standards (OOP layers and patterns; no `any`; validation at boundaries; one error envelope; comments that explain why);
  - security, performance and testing;
  - the UI rules (section 9 below);
  - the Git and AI rules;
  - the Definition of Done.
- **Repository files:**
  - `.claude/settings.json`, as Richie placed it;
  - `.editorconfig`;
  - `.gitattributes`, with LF line endings;
  - `.gitignore`, covering every `.env*` except `.env.example`, `samples/*` except its README, build output and AI tool folders;
  - `.node-version`, set to `24.22.0`.
- **ADRs:**
  - `docs/adr/0001-record-architecture-decisions.md`;
  - `0002-a-clean-repository-for-ps11.md`: the lecturer's request; nothing from other statements; the team lead builds every area's base and then the owners take over; and the earlier repository, archived and read for lessons only.
- **`docs/agile/`:**
  - the README;
  - the working agreement: roles, the sprint rules in section 5, ceremonies, the board, a work-in-progress limit of two per person, a reviewer of the day, and communication;
  - the Definitions of Ready and Done, for each story, each sprint, and each assessment release (Weeks 5, 13 and 18, each tagged).
- **`docs/ai/ai-usage-log.md`:** one table per area, with the platform and area 1 first.
- **This prompt:** move it to `docs/ai/prompts/001-build-the-base.md`.
- **`docs/BUILD_REPORT.md`:** one short section per prompt.

**P-2 GitHub as code** (`chore/github-process`)

- **`.github/`:**
  - issue forms for stories, tasks, epics, spikes and bugs, with blank issues off and contact links to this repository's security advisories and docs;
  - the pull request template (rule 3, the areas, M1 to M6, a UI checklist, docs, data and security, and the Definition of Done);
  - `CODEOWNERS`, with placeholders until T-1;
  - `labels.json`;
  - `rulesets/main.json`, mirroring the live ruleset after every change.
- **Labels:**
  - `type:` epic, story, task, bug, spike, chore, docs and security;
  - `area: 1 document AI and integration`, `area: 2 order workflows and approvals`, `area: 3 checks, tracker and insights`, `area: 4 controls and monitoring`, and `area: team`;
  - `priority:` must, should and could;
  - `req: M1` to `M6`, each with its name;
  - `status: blocked`, `status: needs client input`, and `dependencies`.
- **`scripts/github/`, all idempotent:**
  - labels;
  - the sprint calendar (Sprint 1 starts Monday 26 Oct 2026; each sprint is due Sunday 23:59 Singapore time);
  - the board **OrderPilot delivery**, with Status, a Sprint iteration, Estimate and Area, and Backlog and Sprint views;
  - the backlog as data: epics P, A to G and T, with the stories in this prompt and their acceptance criteria, estimates, priorities and areas, seeded as sub-issues of their epics;
  - the rendered `docs/agile/backlog.md` and the wiki's sprint calendar;
  - wiki publishing.
- **The sprint recorder:**
  - `.github/workflows/sprint-recorder.yml` sets an issue's milestone to the sprint of the day it closes, or of the day its pull request merges;
  - `scripts/github/sprint-report.mjs` prints what closed this sprint and what is in progress, by area.
- **`docs/wiki/`:** Home, Getting started (what works so far), How we work, Definition of Done, Team and areas, Sprint calendar, Security, and the sidebar.
- **After the merge,** run the scripts, then publish the wiki. If the token lacks the project scope, ask Richie to run `gh auth refresh -s project`. Ask him to group the board's Backlog view by Sprint, which the API cannot do.

**P-3 The problem, the research and the questions** (`docs/problem-and-questions`)

- `docs/problem-statement.md`: the brief in our words, stakeholders, pain points, root cause, constraints, scope, success metrics and open questions.
- `docs/assumptions.md`.
- `docs/client/questions-for-client.md`:
  - the three items to ask for first: anonymised samples of every document type including the SPR form; a Navision export; and the timeline of one real order;
  - then the questions in priority order;
  - a note to send the priority questions before the briefing call.
- `docs/data-formats.md`: the assumed formats of every document and Navision export, each to confirm, and how to try a client sample safely.
- `docs/agile/hero-journey.md`: the sales-pilot demo story, E2E #1 to #4, and a presenter slot for each area.
- `docs/requirements-traceability.md`: M1 to M6 → planned features → where → evidence.
- `docs/research/README.md`: where Richie's ERP notes go, in his own words only.
- **Starting points for the team:**
  - `docs/design-thinking/`: the method; personas started from the role table; current and future journeys of the sales flow; how might we; hypotheses; and success metrics with a measurement protocol (time, touches and errors, manual against OrderPilot);
  - `docs/grs/grs-by-design.md`:
    - governance;
    - a risk register (AI errors, bank-detail fraud, data leaking to AI providers, PDPA, prompt injection, ERP changes);
    - sustainability: less re-typing, fewer reshipments, and AI only where it helps, with its cost tracked.

    Never claim the prototype is PDPA compliant.

**P-4 The four areas** (`docs/areas`)

- `docs/team/module-ownership.md`: the owners, the paths each area owns, the shared files and who reviews them, and backup owners (TBD until T-1).
- **Four guides:**
  - `area-1-document-ai-and-integration.md`;
  - `area-2-order-workflows-and-approvals.md`;
  - `area-3-checks-tracker-and-insights.md`;
  - `area-4-controls-security-and-monitoring.md`.

  Each guide covers:
  - the goal and user stories;
  - the contracts;
  - a recommended design (patterns, data flow, sequence);
  - **What the base gives you** and **What's yours to build** (the A-level depth);
  - what the owner explains at the Week 7 interview;
  - the risks;
  - the module requirements it covers.

**P-5 Monorepo and tooling** (`chore/monorepo-tooling`)

- **The workspace:**
  - a pnpm workspace (`apps/*`, `services/*`, `packages/*`) and root scripts;
  - `packages/tsconfig` (strict) and `packages/eslint-config` (flat, type-aware, with jsx-a11y, failing on any warning);
  - Prettier, commitlint (config-conventional), Dependabot (npm and Actions, weekly on Monday 06:00 Singapore time, a 7-day cooldown, grouped) and a fresh lockfile.
- **Git hooks:**
  - **commit message:** commitlint;
  - **pre-commit:** the licence-key guard (the values of `REACTBITS_LICENSE_KEY` and `REUI_LICENSE_KEY` never in staged files), the samples guard, a secretlint scan, the em-dash check, and lint-staged;
  - **pre-push:** the samples guard on every commit being pushed.
- **Scripts:** `scripts/check-licence-key.mjs`, `scripts/check-samples.mjs`, `scripts/check-dashes.mjs`, and `samples/README.md`.
- **Supply-chain settings:** exact version pins; `minimumReleaseAge`; reviewed `allowBuilds`; and overrides and ignored advisories, each with a reason and a review date.
- **ADRs:** pnpm monorepo; TypeScript and ESM.

**P-6 CI and the security baseline** (`ci/verify-and-scan`)

- **`ci.yml`, the `verify` job ("Lint, typecheck, test, build"):**
  - the samples history check;
  - a frozen install;
  - `pnpm audit --audit-level high`;
  - format, the em-dash check, lint, typecheck, tests and build.

  Later stories add the bundle budget, the diagrams check and the slides check.

- **`security.yml`:**
  - **"SAST (Semgrep)":** Semgrep with the default, TypeScript, React, Node and OWASP Top 10 rules;
  - **"Secret scan (gitleaks)":** across the full history;
  - **"Dependency scan (OSV)":** on the lockfile.
- **Workflow hygiene:**
  - least-privilege `permissions`;
  - actions pinned to commit SHAs;
  - `concurrency` that cancels superseded runs;
  - caching.

  Once private, the repository gets 3,000 Actions minutes a month. To save minutes, skip heavy jobs with job-level conditions; a skipped job still counts as passed. Never add workflow-level path filters to required workflows.

- **Required from now on:** the four checks above.
- **Docs:**
  - `docs/agile/test-plan.md`: the test levels, environments and data, and a failure and edge-case matrix seeded with #11's cases, each marked planned with its story;
  - `docs/security/security-testing.md`: what runs where, and the triage process (fix, or accept or dismiss with a reason and a review date).
- **ADRs:** the testing strategy; the DevSecOps tools.

### Part 2: the app runs

**P-7 Shared contracts** (`feat/platform-shared-contracts`)

- `packages/shared`, with zod schemas and types:
  - the response envelope and the error envelope `{ error: { code, message, details, traceId } }`, and the error codes;
  - the nine roles;
  - the permissions the platform checks so far;
  - the session and user reference, and the audit and AI-usage types.
- **The first draft of the order and event contract:**
  - order headers and lines;
  - documents and their types;
  - field values with confidence and provenance;
  - domain event names.

  Mark it "draft for the team to agree in Week 3". Status stays in area 2.

- **ADR:** shared contracts.

**P-8 The API shell** (`feat/platform-api-shell`)

- **NestJS, in layers:** controllers, services, repositories (the only place Prisma is called) and domain classes.
- **Typed configuration:**
  - a zod schema;
  - **one root `.env` is enough**: load `apps/api/.env`, then the root `.env`, never overriding what the shell, CI or Docker set, and skipping missing files quietly;
  - a clear message naming the file to create when something required is missing.
- **Security:** helmet with a strict CSP, a CORS allow-list and rate limiting.
- **The rest of the shell:**
  - Swagger "OrderPilot API" at `/api/docs`;
  - pino with correlation ids;
  - a global exception filter;
  - a zod validation pipe;
  - `/health`, `/health/live` and `/health/ready`;
  - `apps/api/requests/*.http`;
  - Vitest;
  - `docs/architecture/` (README and patterns).
- **ADRs:** NestJS layered modules; the observability baseline.

**P-9 Database, Redis, document storage and the local stack** (`feat/platform-database`)

- **Prisma with PostgreSQL:** `User`, `RefreshToken`, `RolePermission`, and `AuditEvent` with an append-only trigger. The audit writer chains each event's hash to the one before it, verifies the chain, and joins the business transaction.
- **Redis with BullMQ:** the queue module.
- **MinIO** (S3-compatible) behind a storage service that uses the S3 API, so AWS S3 drops in later.
- **The test harness:** its own database and Redis database; a global set-up that migrates and seeds; and a data reset.
- **`docker-compose.yml`:** PostgreSQL, Redis and MinIO, under compose project name `orderpilot`.
- **Ports from `.env`:** `POSTGRES_PORT`, `REDIS_PORT` and `MINIO_PORT`, with `DATABASE_URL`, `REDIS_URL` and the test URLs built from them (dotenv-expand). Changing one line moves them all.
- **`.env.example`:** one root file documenting every variable with a safe default.
- **Guides:**
  - Getting started and `CONTRIBUTING.md` say `cp .env.example .env`;
  - troubleshooting covers "port already in use", "role does not exist" (another PostgreSQL answered) and Docker not running.
- **Prove it:** from a clean clone with nothing loaded in the shell, on the default ports and again with `POSTGRES_PORT=5433`.
- **ADRs:** Prisma with PostgreSQL; S3-compatible document storage.

**P-10 Sign-in and sessions** (`feat/platform-auth`)

- **Credentials and tokens:**
  - argon2 password hashing;
  - a JWT access token in an httpOnly, Secure, SameSite cookie;
  - refresh-token rotation with reuse detection;
  - CSRF protection.
- **A demo sign-in (`DEMO_MODE`)** offering the nine roles, with synthetic names.
- **Guards:** a users module, plus auth, CSRF and permissions guards. The permissions guard calls the role-permission matrix, which area 4 owns.
- **Seeds:** a user for every role, and the default matrix.
- **Audit:** every sign-in, sign-out and change.
- **Integration tests:** 401, 403 and validation cases.
- **ADR:** sessions and RBAC.

**P-11 The web shell** (`feat/platform-web-shell`)

- **The stack:** Vite, React 19, TypeScript and Tailwind v4, with shadcn/ui set up by its Vite guide.
- **Design tokens:**
  - a warm neutral base with a deep jade accent;
  - light and dark themes;
  - an 8-pt spacing grid;
  - radius and motion values;
  - the Geist font, with tabular numbers.
- **App plumbing:**
  - React Router with route guards;
  - an `ApiClient` class;
  - TanStack Query;
  - a minimal Zustand store;
  - react-i18next (English, with no hard-coded strings);
  - React Hook Form with zod.
- **The shell:**
  - a sidebar for each role;
  - breadcrumbs;
  - a ⌘K command palette;
  - a theme switch;
  - the demo role switcher;
  - notifications and a user menu.
- **Pages:**
  - the login page, plain for now (Pro blocks come in P-22);
  - settings;
  - a "planned" page for each area;
  - error pages.
- **Assets:** a theme script that stops the wrong theme flashing, and an OrderPilot favicon.
- **Budgets and tests:**
  - the bundle budget (initial JS 250 KB gzip or less, 3D excluded) joins the verify job;
  - component tests with Testing Library.
- **UI sources while the repository is public:**
  - shadcn/ui;
  - Magic UI (free);
  - React Bits (free, `@react-bits`);
  - ReUI's free components, only if they install without the licence key.
- **ADRs:** the web stack; i18n with English first; CSP and inline styles.

**P-12 Common components** (`feat/platform-web-components`)

- **Data and layout:**
  - a data table with server-side paging, sorting, filtering and column visibility;
  - the page header and section cards.
- **Every state:** loading skeleton, empty with a next action, error with retry and a trace id, partial, and permission denied.
- **Badges:** "Mock", "Mock AI", "Synthetic demo data", status, and classification.
- **Small pieces, with tests:**
  - a masked value with "why is this hidden";
  - a confidence badge that says "Requires approval";
  - an audit link;
  - relative time;
  - a copy button;
  - the planned page.

**P-13 Docker images and the IaC scan** (`ci/docker`)

- **Images:**
  - multi-stage, running as non-root, with health checks;
  - one for the API (with a worker entry);
  - one for the web app: nginx with security headers and an SPA fallback;
  - a generic one for the mock services.
- **Compose:**
  - `api`, `worker` and `web` services, each waiting on its dependencies' health checks;
  - `.dockerignore`;
  - a samples override: a throwaway stack that only this machine can reach, for trying a client sample, deleted afterwards.
- **CI:**
  - "Docker images": builds every image, then a Trivy image scan that fails on fixable HIGH or CRITICAL findings;
  - "IaC and Dockerfile scan": Trivy config.

  Both become required.

- **ADR:** Docker and the deployment target.

**P-14 End-to-end smoke** (`test/e2e-smoke`)

- Playwright with axe, plus helpers for the demo session and the layout.
- A smoke test that signs in as each role, opens the shell and signs out, with WCAG 2.2 AA checked on every page.
- The CI job "End-to-end smoke" runs it against the compose stack, uploads the report and shows the service logs on failure. It becomes required.

**P-15 Events, queues and live updates** (`feat/platform-events`)

- **Events:** a typed domain event bus, with a transactional outbox and idempotency keys.
- **Workers:** a BullMQ worker process.
- **Live updates:** an SSE stream to the web app, and a hook that listens to it.
- **ADR:** jobs, events and realtime.

**P-16 Diagrams as code** (`docs/diagrams`)

- **The pipeline:** Mermaid sources rendered to SVG by `scripts/build-diagrams.mjs` (using Playwright's Chromium), with `diagrams:check` in CI.
- **The diagrams:**
  - C4 context and containers;
  - the sales flow and the purchase flow, showing who does what;
  - the PO-to-approval sequence;
  - the data model, generated from `schema.prisma`;
  - data flow, with trust boundaries and GRS controls;
  - deployment, local and on AWS.

### Part 3: area 1's core (Richie's area, part of the base)

**P-17 The AI gateway** (`feat/area1-ai-gateway`)

- **`LlmGateway` with three providers:**
  - **mock:** the default; deterministic, and works offline;
  - **OpenAI-compatible:** a base URL, a key and a model, so Groq, Gemini's OpenAI-compatible endpoint, OpenRouter, NVIDIA NIM and Ollama all work by configuration alone;
  - **Bedrock:** optional.
- **Calls:**
  - structured output validated with zod, with retries;
  - page images for vision models (Groq's `qwen/qwen3.8-27b` takes up to 3 images a request).
- **Usage tracking:**
  - `AiUsageTracker` and `AiUsageRecord` log tokens, model, latency, estimated cost, feature, user, document and outcome;
  - the data the web app needs to show its "Mock AI" badge.
- **Prompt-injection defence:**
  - documents are treated as data;
  - the model only returns fields;
  - no model output triggers an action.
- **A destination check:** area 4's policy decides what data may go to which provider. The default is synthetic data only.
- **Keys:** ask Richie to add `GROQ_API_KEY` and `GEMINI_API_KEY` to the root `.env` himself. Never ask for them in chat.
- **ADR:** the AI gateway and the person in the loop.

**P-18 Document intake and storage** (`feat/area1-document-intake`)

- **Upload API:**
  - accepts PDF, PNG, JPEG, XLSX and CSV;
  - size limits, type sniffing and a zip-bomb guard;
  - nothing executable;
  - stored through P-9's storage service.
- **Processing:**
  - PDF text extraction (pdfjs-dist) plus page images for the vision models;
  - duplicate detection by content hash.
- **Data model:** the start of area 1's order data: orders, order lines, documents, and field values with confidence and provenance. Status stays in area 2.
- **UI:** an upload screen with drag and drop, and a documents list.
- **Queue:** a job that marks each document "awaiting AI" until the extraction stories.

**P-19 Mock Navision and synthetic master data** (`feat/area1-mock-navision`)

- **`services/mock-navision`:** an OData-style API with paging and `$filter`, behind an API key, for:
  - Items, Customers, Vendors, PriceLists and StockLevels;
  - SalesOrders, PurchaseOrders and Receipts.
- **`packages/synthetic-data`:**
  - a seeded random generator;
  - a Spectra-like catalogue of fictional brands' IT, surveillance and accessory products, with part numbers;
  - customers in India, Sri Lanka, Bangladesh, Pakistan and the UAE;
  - vendors, stock, and USD prices.
- **Realism:** take document numbering and statuses from Richie's notes when present.
- **The rest of the story:** tests, a compose service, `docs/api/mock-systems.md`, and a "Mock" label wherever it's used.
- **ADR:** mock external systems.

**P-20 The connector framework and the Navision adapter** (`feat/area1-connectors`)

- **The framework:**
  - a `SystemConnector` interface over named record kinds (items, customers, vendors, price lists, stock levels and mail messages);
  - a factory (credentials only from the environment);
  - a health probe and a retry policy with backoff;
  - an HTTP JSON client with timeouts;
  - data minimisation and an offline connector;
  - the `Connector` model and a connectors page.
- **The Navision adapter,** so a stock lookup works end to end, with contract tests against the mock.
- **ADR:** hub-and-spoke integration.

**P-21 Synthetic documents** (`feat/area1-synthetic-documents`)

- **`packages/synthetic-documents`** generates PDFs from the synthetic master data:
  - POs in at least four customer layouts;
  - PIs, invoices, packing lists and AWB/BL;
  - scanned-looking variants (rotated and noisy).
- **Planted mistakes:** quantity, price, PO reference, part number and changed bank details.
- **Ground truth:** a JSON file for every document, for the accuracy harness.
- **Delivery:** a CLI (`pnpm docs:generate`), with a set copied to `apps/web/public/demo-documents/` for demo uploads. (Not a folder called `samples`: that name is reserved for client samples, which never enter Git.)

## 7. The area bases (after P-10 to P-12)

These are each owner's head start, built the way a head start is: never the area's core logic.

- **What each base includes:**
  - its models;
  - contracts, with routes returning typed mock data in Swagger;
  - high-fidelity screens wired to those routes, covering every state;
  - test skeletons, as `it.todo` with the key cases named;
  - the "What the base gives you" and "What's yours to build" sections of its guide, filled in.
- **When an area's base is merged,** tell Richie, so he can hand it over.
- **Its own PR:** request the owner's review on each area's pull request once they are collaborators.

**C-1 Area 2 base, the workflow module** (Azri)

- **Models:** workflow definitions, instances, tasks, events and notifications.
- **Screens:** each role's task inbox; an order's steps and timeline; the SPR approval page (approve or reject, with a comment); reminders.
- **To-do tests:** transitions, SPR limits, the payment gate, reminders and escalations, and retries with idempotency.
- **Left to Azri:**
  - his state machine, which he writes again himself as his first story, so it stays his work;
  - Spectra's sales and purchase flows, the SPR rules, the payment gate and the SLA logic.

**D-1 Area 3 base, checks and the tracker** (Iok Teck)

- **The checks module:**
  - a check-rule Strategy interface;
  - check-result and exception contracts;
  - an empty exceptions model.
- **Screens:**
  - the order tracker (status, owner, overdue flags);
  - an order's detail timeline;
  - the exceptions queue;
  - a KPI dashboard of Spectra's five measures.
- **To-do tests:** the MVP mismatch (the packing list's quantity against the PO), tolerances, and the KPI formulas.
- **Left to Iok Teck:** every check and its tolerance, the exceptions flow, the tracker's logic and the KPIs.

**F-1 Area 4 base, access policy and masking** (Angelyn)

- **Policy and masking:**
  - a role-permission matrix screen;
  - the masking mechanism, with a neutral sample rule;
  - classification contracts;
  - the contract for what data may go to which AI provider;
  - how a refusal looks.
- **To-do tests:**
  - approval limits;
  - no self-approval;
  - the bank-detail hold;
  - masking for each role;
  - a direct API call being refused (E2E #3).
- **Left to Angelyn:** the real policy, limits, segregation-of-duties rules, the bank-detail control and the masking rules.

**F-2 Area 4 base, the audit viewer** (Angelyn)

- The audit log viewer over the real hash chain, with filters and a chain check.
- To-do tests for export and retention.

**G-1 Area 4 base, monitoring** (Angelyn)

- **Wiring:**
  - OpenTelemetry for traces and metrics;
  - `/metrics` with prom-client;
  - an `AnalyticsTracker` class (batching, consent, no PII), a clickstream endpoint and a `ClickstreamEvent` model.
- **Screens:**
  - **AI usage and cost:** reads real records;
  - **observability and clickstream:** mock data, with to-do tests.
- **Left to Angelyn:** the real dashboards, budgets and alerts, in Weeks 14 to 16 (Sprints 13 to 15).

## 8. After the repository is private, then deployment

If these come up before their condition is met, skip ahead and come back.

**P-22 The design system with the Pro kits** (`feat/platform-design-system`), only once Richie says the repository is private and the keys are in `apps/web/.env.local`.

- **Registries in `apps/web/components.json`:**
  - `@reactbits-starter`: `https://proxy.collectui.pro/api/r/reactbits/starter/{name}.json`;
  - `@reactbits-pro`: `https://proxy.collectui.pro/api/r/reactbits/pro/{name}.json`;
  - `@reui`: `https://reui.io/r/{style}/{name}.json`;
  - `@magicui`: `https://magicui.design/r/{name}`.

  The React Bits entries send the header `Authorization: Bearer ${REACTBITS_LICENSE_KEY}`, and `@reui` sends `Authorization: Bearer ${REUI_LICENSE_KEY}`.

- **Verify each source** with a test install, and report exact errors.
- **Tools for you:**
  - the React Bits skill (`npx shadcn@latest add @reactbits-starter/skill`), placed at `.claude/skills/reactbits/SKILL.md` and read in full before you use any item;
  - the shadcn MCP (`npx shadcn@latest mcp init --client claude`);
  - ReUI's MCP server at `mcp.reui.io`, with its token kept out of Git.
- **`docs/design/reactbits-usage.md`:** a plan for every page:
  - which React Bits, ReUI and Magic UI items it uses, and why;
  - 20 or more distinct items across the app;
  - at least one item on every page;
  - Pro blocks on landing and login;
  - Application UI wherever it matches;
  - only subtle items on dense work screens.
- **`docs/design/design-system.md`.**
- **`CONTRIBUTING.md`:** teammates never need the keys to run or build, because added components are code in the repository. Adding a new Pro component goes through Richie.
- **Then upgrade:** login and landing with Pro blocks, and the screens where items fit. Every item is adapted to the tokens, one component per file, with a header comment stating its origin.
- **ADR:** component registries, and why licensed code needs a private repository.

**P-23 The 3D order constellation** (`feat/area1-order-constellation`)

- **The concept:**
  - the OrderPilot core, in faceted glass with an emissive inner light;
  - around it, six team stations (Product Managers, Approver, Support, Warehouse, Finance and Logistics), plus Navision and the mailbox;
  - documents travel as glowing packets along arcs while an order moves;
  - status colours (on time, waiting, exception) come from real workflow events over SSE.
- **Where it appears:** on landing and login, and as a live operations view.
- **Assets:**
  - parametric Blender Python scripts in `assets-src/3d/`, with PBR materials, bevels and clean topology;
  - run headless with `blender -b -P` (Blender is at `C:\Program Files\Blender Foundation\Blender 5.2\`; if it's missing, ask Richie to run `winget install BlenderFoundation.Blender`);
  - exported to GLB and quantised with glTF Transform, with no WebAssembly decoders (keeping the strict CSP);
  - 1.5 MB or less in total.
- **Rendering:**
  - React Three Fiber, drei and postprocessing;
  - ACES filmic tone mapping, a studio environment and soft shadows;
  - bloom, a subtle depth of field and a vignette;
  - spring motion and a slow cinematic camera that the user can take over;
  - hover tooltips, and clicking a node to navigate;
  - React Bits overlays for labels.
- **Performance and access:**
  - a lazy chunk, DPR clamped to [1, 2], and adaptive quality;
  - pauses when off-screen or when the tab is hidden;
  - a still frame for reduced motion, and a fallback image without WebGL;
  - a keyboard-usable list beside the canvas;
  - 60 fps on a mid-range laptop, reported honestly.
- **ADRs:** 3D assets without WebAssembly decoders; the constellation scene.

**P-24 Cloud deployment** (`feat/platform-deploy`), only once Richie confirms step 8 of his guide.

- **What Richie gives you:**
  - an Amazon Lightsail server `orderpilot-prod` in Singapore: Ubuntu 24.04 LTS, 4 GB memory, a static IP, and a firewall open on 22, 80 and 443;
  - the path of its SSH key on his PC, and its domain (an `sslip.io` name made from the static IP);
  - a GitHub environment `production`, limited to `main`, holding `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_DOMAIN`.
- **`infra/deploy/`:**
  - a server bootstrap that you run over SSH: Docker, the host firewall (22, 80 and 443), fail2ban, swap, and automatic security updates;
  - the app in `/opt/orderpilot`, with its own `.env` created there with generated secrets that are never printed. Richie adds the AI keys to it himself; ask him when it exists;
  - Caddy for HTTPS, with the certificate for `DEPLOY_DOMAIN`;
  - `docker-compose.prod.yml`, with no development ports;
  - nightly PostgreSQL and MinIO backups, keeping seven days.
- **`deploy.yml`:** on each merge to `main`, after CI:
  1. build the images and push them to GHCR, keeping only the latest five versions of each (Pro includes 2 GB of package storage);
  2. SSH to the server and pull them, logging in to GHCR with the workflow's own short-lived token, so the server holds no GitHub credential;
  3. run the migrations;
  4. check health, and roll back to the previous images on failure.
- **Docs:**
  - `docs/deploy.md`: deploy, roll back, rotate secrets, read logs, restore a backup, and shut everything down after the module;
  - the README gets the live demo link and a deployment table.
- **A DAST job:** an OWASP ZAP baseline scan of the live URL, weekly and on demand, with its report kept.
- **ADR:** the deployment.

**P-25 Slides as code** (`docs/slides`)

- A Marp deck for the Week 5 proposal: 12 to 14 slides, one idea each, themed with the app's tokens, using real screenshots and diagrams, with speaker notes.
- `pnpm slides:build` exports PDF, HTML and PPTX.
- `slides:check` runs in CI.

## 9. UI rules (all screens)

- **The bar:** Linear or Stripe-dashboard quality, calm and trustworthy.
- **Layout:**
  - design tokens only;
  - the same page anatomy everywhere: header, then filters and actions, then content;
  - 60 to 80 characters per line of prose;
  - at most 7 type sizes.
- **Every state** is handled: loading, empty, error with retry and a trace id, partial, success and permission denied.
- **WCAG 2.2 AA:**
  - text contrast of 4.5:1 or more, and visible focus;
  - full keyboard use, ARIA labels and semantic HTML;
  - reduced motion respected.
- **Motion:** 150 to 250 ms ease-out for UI, springs for spatial movement, and never animate tables or forms while they are in use.
- **GRS visible in the UI:**
  - classification badges;
  - masked fields with a reason;
  - audit links;
  - approval steps;
  - AI confidence with "Requires approval".
- **Banned:** lorem ipsum, "John Doe", emoji used as icons, mixed icon sets (Lucide only), centred body text, and more than one primary button per view.
- **Performance:** route-level code splitting, with 3D and charts lazy-loaded; pagination and an index for every query; LCP under 2.5 s; Lighthouse 90 or more at each release.

## 10. Team stories (create them now)

- **T-1 Owners, backups and reviews** (now):
  1. Ask Richie for each teammate's GitHub username.
  2. Invite them with Write access, and add them to the board.
  3. Ask Richie for each area's backup owner.
  4. Fill `CODEOWNERS` so every path has at least two owners and nobody ever waits on their own approval: each area's paths go to its owner, its backup owner and Richie, and shared files go to Richie and the backup owners.
  5. Ask each teammate to commit with their GitHub no-reply email (GitHub, Settings, Emails), never a school email.
- **T-2:** the briefing call with Spectra (Sprint 2).
- **T-3:** the project plan (Sprint 2).
- **T-4:** the UI prototype across the four areas (Sprint 3).
- **T-5:** the proposal deck and presentation, tagged `v0.1-proposal` (Sprint 4).
- **T-6:** design thinking (Sprints 2 and 3).
- **T-7:** GRS by design (Sprints 3 and 4).
- **T-8:** preparing for the mock interview (Sprints 5 and 6).
- **T-9 The handover,** when the base is done:
  - each owner takes over their area;
  - prompt 002 writes epics A to G's stories from the owners' planning notes;
  - one approving review plus code-owner review is switched on, only on Richie's yes;
  - the first sprint is planned by tasks.

**Area 1's own stories,** for Richie after the base. Create them under epics A, B and E:

- **The AI pipeline:**
  - classification;
  - extraction with confidence and provenance;
  - the review screen, with source highlighting;
  - the accuracy harness, with a 95% target and a comparison of models;
  - learning from corrections, one layout at a time;
  - layout mapping, proposed by AI and approved by a person;
  - prompt-injection tests;
  - email intake through a mock mailbox with signed webhooks.
- **Orders and Navision:**
  - duplicate-PO protection;
  - a Navision-ready import file;
  - the template engine for PIs, invoices, packing lists and Excel, used by areas 2 and 3.
- **Could:**
  - QR codes on generated documents and carton labels, for the warehouse to scan;
  - passkeys to confirm risky approvals, with area 4's policy deciding when.

## 11. Practices to keep (tick each in your reports, and say where it lives)

- **Process:**
  - stories under epics, with acceptance criteria;
  - one task per branch and pull request, Conventional Commits, the template, merge commits, and merged branches deleted;
  - reviews within one working day, with threads resolved;
  - a work-in-progress limit of two;
  - weekly sprints as milestones, recorded automatically, with daily notes, a review and a retrospective;
  - the Definitions of Ready and Done;
  - the labels, backlog, board and milestones kept as code;
  - the wiki published from `docs/wiki/`;
  - code owners and backup owners;
  - the ruleset mirrored in Git;
  - release tags `v0.1-proposal`, `v0.2-technical-review` and `v1.0-final` after a feature freeze.
- **Quality and security:**
  - strict TypeScript, lint with no warnings, and formatting;
  - pinned versions and the supply-chain settings;
  - the hooks: licence keys, samples, secrets, em dashes and lint-staged;
  - **CI:** verify, Semgrep, gitleaks, OSV, Docker with Trivy, the IaC scan, end-to-end with axe, and Dependabot;
  - least-privilege workflows;
  - ZAP once deployed, and Lighthouse at each release;
  - **tests:** unit tests at 80% or more on domain logic, API integration tests with 401 and 403, component tests, contract tests and end-to-end tests;
  - a k6 smoke load test of the extraction queue and the order endpoints;
  - `.http` request files.
- **Docs and AI use:**
  - ADRs, traceability, the test plan, data formats, assumptions, client questions and diagrams as code;
  - design thinking and GRS;
  - the AI usage log, with prompts kept (teammates use `areaN-NNN-…`);
  - the build report and `AGENTS.md`;
  - no attribution, and no em dashes.
- **Settings outside Git:** step 0's settings, the board's grouping, and the collaborators.

## 12. Reports

When the base is done, and whenever you are blocked, report:

- each story's pull request and its checks, and anything left out of it, with the reason;
- section 11, ticked, with the story that brings anything still missing;
- which areas are ready to hand over;
- what only Richie can do by hand;
- your questions.

Between reports, keep going. After the base is done, or when blocked, wait for Richie.
