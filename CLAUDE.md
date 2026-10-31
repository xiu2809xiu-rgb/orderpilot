# OrderPilot

This repository holds **OrderPilot**, our product for Problem Statement #11, Spectra Innovations, in the IT2134 IT Innovation Project (SCCCI x NYP AI Innovation Challenge, AY2026 Semester 2).

This file and [`AGENTS.md`](AGENTS.md) are the source of truth. This file holds the product brief, the stack, the standards and the rules for every story. `AGENTS.md` holds the rules for every teammate's AI tool. [Prompt 001](docs/ai/prompts/001-build-the-base.md) is the brief they were written from, and it still lists the stories of the base.

- **A fresh start for #11 only.** Our lecturer asked for a clean repository. Nothing from any other problem statement appears here: no code, names, fields, strings, comments, data, documents, decisions, prompts, logs, screenshots or history. [ADR 0002](docs/adr/0002-a-clean-repository-for-ps11.md) records the decision.
- **Richie, the team lead, builds the base for every area.** When it is done, each owner takes over their own area and the team works sprint by sprint, by tasks.
- **Every piece is merged the normal way:** one story, one issue, one branch, one pull request, green checks.
- **Kiro is only the IDE.** Don't use Kiro specs, steering or hooks.
- **Spectra's documents never go into Git.**
- **Richie's ERP notes.** Richie studied a third-party ERP and may add domain notes in his own words under [`docs/research/`](docs/research/README.md). Use them for realism: document types, fields, numbering and statuses. Never ask for, open, commit or send to an AI service any screenshot or data from that ERP.

**Status words.** "Today" means it is in the repository now. "Planned" names the story that brings it. Until that story merges the thing does not exist, so never describe it as if it did.

## 1. The product

The brief every story serves.

### The client

Spectra Innovations is a Singapore distributor, and master distributor for appointed brands, of IT products and computer peripherals. Its customers are in South Asia (India, Sri Lanka, Bangladesh, Pakistan) and the Middle East, and most of them pay before their goods ship. Its ERP is Microsoft Dynamics Navision.

### The problem

Six groups handle every order by hand: Product Managers, the approver (Janet), Support, Warehouse, Finance and Logistics. Staff re-type data from POs, proforma invoices (PIs), invoices, packing lists and AWB/BL into Navision, and spend their time chasing approvals, payments and shipping papers.

### The two flows

The two flows are linked by the SPR (Sales Purchase Requisition):

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

### What we build

OrderPilot is an AI-assisted order-automation layer **beside** Navision, never instead of it. Its tagline is **"AI reads, rules decide, people approve."**

- **Users:** Spectra's staff only, in one web app behind a login. Each role sees its own tasks.
- **Devices:** desktop first and responsive. The warehouse screens also work on a tablet, with touch targets of 44 px or more.
- **Not a shop:** customers and vendors never log in. They keep emailing documents, and staff send them the updates OrderPilot drafts.

### Roles

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

### Capabilities

- **A. Document intake and AI extraction:** email or upload; classification; extraction with a confidence score and a source link per field; layout mappings that AI proposes and a person approves.
- **B. Master data and Navision:** items, customers, vendors, prices and stock behind a connector; any write-back needs a preview and an approval.
- **C. Order workflows and approvals:** a state machine; tasks for each role; SPR approval within limits; the payment gate; reminders and escalations; generated PIs, invoices and packing lists.
- **D. Checks, the tracker and insights:** documents checked against each other with tolerances; an exceptions queue; one tracker with every order's trail; Spectra's five measures as KPIs.
- **E. AI with a person in the loop:** extraction, mismatch explanations, and drafts that a person sends.
- **F. Financial controls and governance:** no self-approval; approval limits; bank-detail change control; masking of bank details and prices by role; a tamper-evident audit trail.
- **G. Monitoring:** tracing, metrics, clickstream analytics, and the AI cost per document.

### MoSCoW

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

### The AI rules

- The AI reads, classifies, extracts, explains and drafts. It never approves, buys, posts, releases goods or pays: a person does, and that is audited.
- It never makes a purchase. It pre-fills an SPR or a vendor PO draft, and a person approves before anything happens.
- **Enter once, flows everywhere.** Data a person confirms feeds every team's task and the tracker. Writes to Navision and messages to customers wait for a person's OK.

### Where we use AI

| Task                                                     | Approach                                              |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Reading fields from POs, PIs, invoices and packing lists | AI extraction with confidence scores and human review |
| Telling document types apart                             | AI classification                                     |
| Comparing quantities, prices and PO references           | Fixed rules                                           |
| SPR routing and limits                                   | Workflow rules; a person approves                     |
| Releasing packing after payment                          | A rule plus Finance's confirmation                    |
| Explaining an exception                                  | An AI summary; the logs stay the source of truth      |
| Drafting customer or vendor emails                       | An AI draft; a person sends it                        |

### Data rules

- Synthetic data only, labelled "Synthetic demo data". Obviously fake bank details, no national ID numbers, and prices in USD.
- Mask bank details and prices by role, with a reason.
- Every extracted field keeps its confidence and source. AI output is a draft until a person confirms it.
- Match customers, vendors and items on their Navision numbers, never on names. A look-alike name is shown as a possible match.
- Open business rules are configuration until Spectra confirms them: the SPR trigger, the PI sequence, approvers and limits, and delegation.
- No Spectra document goes to a third-party AI without their written OK, in an approved region.

### Targets

- extraction accuracy of 95% or more on the synthetic test set;
- every seeded mismatch flagged;
- no duplicate orders;
- 100% of workflow tests passing;
- time and touches per order measured;
- every overdue follow-up visible.

Spectra's own five measures sit alongside these: order-processing time, manual touches per order, data-entry errors, approval turnaround and overdue orders.

### End-to-end tests

- **#1, the sales pilot:** upload, two fields confirmed, stock, SPR, a reminder, the mismatch, and the tracker.
- **#2, AI layout mapping:** a new layout is mapped by AI and approved by a person.
- **#3, refusals:** an unauthorised direct API call is refused, segregation of duties and masking hold, and every refusal is audited.
- **#4, the purchase flow:** a vendor PI with changed bank details holds the payment.

### The areas

| Area                                 | Owner    | Builds                                                                                                                  |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Document AI and integration       | Richie   | The whole AI pipeline, intake, documents and orders data, master data, connectors, the platform and the 3D scene        |
| 2. Order workflows and approvals     | Azri     | The workflows on his state machine, tasks, SPR approval, the payment gate, reminders and generated documents            |
| 3. Checks, tracker and insights      | Iok Teck | The checks engine, the exceptions queue, the tracker and the KPIs                                                       |
| 4. Controls, security and monitoring | Angelyn  | The authorisation policy, bank-detail control, masking, audit, data-to-AI rules, observability, clickstream and AI cost |

### How the areas connect

- Order status lives only in area 2's state machine.
- Area 3 reports pass or fail to area 2.
- Area 4's policy is enforced on the server, and endpoints call it.
- The AI pipeline stays whole in area 1.
- The team agrees the order and event contract together in Week 3.

### The module

| Week | Assessment                                              | Weight          |
| ---- | ------------------------------------------------------- | --------------- |
| 5    | Proposal                                                | 25%             |
| 7    | Mock job interview: each member explains their own code | 15%, individual |
| 13   | Technical review                                        | 25%             |
| 18   | Final                                                   | 35%             |

- 85% of the marks are individual, so ownership must be obvious.
- The six module requirements are M1 design thinking, M2 GRS by design, M3 AI-assisted coding, M4 best practices, M5 team Git workflow, and M6 deploy and monitor.
- Every feature traces to at least one of them.

## 2. The stack

Each row says whether it exists today or which story brings it. Everything marked planned is the plan, not a fact. The story that delivers a row changes it to Today, and pins the exact versions when it installs them.

| Concern                 | Choice                                                                                                                                                                   | Status                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Runtime                 | Node 24.22.0, set in `.node-version`                                                                                                                                     | Today                                |
| GitHub scripts          | `scripts/github/`: plain Node ESM with no dependencies, calling GitHub through `gh api`, tested with `node --test` ([ADR 0016](docs/adr/0016-github-process-as-code.md)) | Today                                |
| Workspace               | pnpm workspace (`apps/*`, `services/*`, `packages/*`) with root scripts                                                                                                  | Today                                |
| Language                | TypeScript, strict, ESM, from `packages/tsconfig`                                                                                                                        | Today                                |
| Lint and format         | ESLint flat config from `packages/eslint-config` (type-aware, with jsx-a11y, failing on any warning), Prettier and commitlint (config-conventional)                      | Today                                |
| Git hooks               | Commit message: commitlint. Pre-commit: licence-key guard, samples guard, secretlint, em-dash check and lint-staged. Pre-push: samples guard on every commit             | Today                                |
| Dependency updates      | Dependabot for npm and Actions, weekly on Monday 06:00 Singapore time, a 7-day cooldown, grouped                                                                         | Today                                |
| CI and scans            | GitHub Actions: `ci.yml` (verify) and `security.yml` (Semgrep, gitleaks, OSV), then Trivy (P-13)                                                                         | Today (P-6), P-13                    |
| Shared contracts        | `packages/shared`: zod schemas and types                                                                                                                                 | Built: P-7 (draft order contract)    |
| API                     | NestJS in layers, with Swagger "OrderPilot API" at `/api/docs`                                                                                                           | Today (P-8)                          |
| Logging                 | pino with correlation ids                                                                                                                                                | Today (P-8)                          |
| Database                | Prisma with PostgreSQL                                                                                                                                                   | Planned: P-9                         |
| Queues                  | Redis with BullMQ                                                                                                                                                        | Planned: P-9, worker process in P-15 |
| Document storage        | MinIO behind a storage service that uses the S3 API, so AWS S3 drops in later                                                                                            | Planned: P-9                         |
| Sessions                | argon2, a JWT access token in a cookie, refresh-token rotation and CSRF protection                                                                                       | Planned: P-10                        |
| Web                     | Vite, React 19, TypeScript, Tailwind v4 and shadcn/ui ([ADR 0013](docs/adr/0013-the-web-stack.md))                                                                       | Built: P-11                          |
| Web plumbing            | React Router, an `ApiClient` class, TanStack Query and a minimal Zustand store                                                                                           | Built: P-11                          |
| Text                    | react-i18next: English, with no hard-coded strings ([ADR 0014](docs/adr/0014-i18n-with-english-first.md))                                                                | Built: P-11                          |
| Forms                   | React Hook Form with zod                                                                                                                                                 | Built: P-11                          |
| Icons and type          | Lucide only, and the Geist font with tabular numbers                                                                                                                     | Built: P-11                          |
| Containers              | Docker Compose under project name `orderpilot`: PostgreSQL, Redis and MinIO, then `api`, `worker` and `web`                                                              | Planned: P-9, P-13                   |
| Tests                   | Vitest, Testing Library, and Playwright with axe                                                                                                                         | Today (P-8, P-11), P-14              |
| Events and live updates | A typed domain event bus, a transactional outbox, idempotency keys and SSE                                                                                               | Planned: P-15                        |
| Diagrams                | Mermaid sources rendered to SVG                                                                                                                                          | Planned: P-16                        |
| AI                      | `LlmGateway` with three providers: mock (the default), OpenAI-compatible, and optional Bedrock                                                                           | Planned: P-17                        |
| Document processing     | pdfjs-dist for PDF text, plus page images for the vision models                                                                                                          | Planned: P-18                        |
| Mock ERP                | `services/mock-navision`: an OData-style API, labelled "Mock" wherever it's used                                                                                         | Planned: P-19                        |
| Integration             | A `SystemConnector` framework and the Navision adapter                                                                                                                   | Planned: P-20                        |
| 3D                      | Blender scripts, glTF Transform, and React Three Fiber with drei and postprocessing                                                                                      | Planned: P-23                        |
| Deployment              | Amazon Lightsail in Singapore, Caddy for HTTPS, images on GHCR, and OWASP ZAP against the live URL                                                                       | Planned: P-24                        |
| Slides                  | Marp                                                                                                                                                                     | Planned: P-25                        |
| Monitoring              | OpenTelemetry for traces and metrics, `/metrics` with prom-client, and an `AnalyticsTracker` class                                                                       | Planned: G-1                         |

## 3. Repository layout

| Path                           | Holds                                                                                                            | Status                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `apps/api`                     | The NestJS API, with a worker entry                                                                              | Today (P-8), P-13                 |
| `apps/web`                     | The web app                                                                                                      | Built: P-11                       |
| `services/mock-navision`       | The mock of Navision                                                                                             | Planned: P-19                     |
| `packages/tsconfig`            | The strict TypeScript config                                                                                     | Today                             |
| `packages/eslint-config`       | The flat, type-aware ESLint config                                                                               | Today                             |
| `packages/shared`              | Shared zod schemas and types: envelopes, error codes, roles, permissions, and the order and event contract       | Built: P-7 (draft order contract) |
| `packages/synthetic-data`      | The seeded generator and synthetic master data                                                                   | Planned: P-19                     |
| `packages/synthetic-documents` | Generated PDFs with planted mistakes and ground truth                                                            | Planned: P-21                     |
| `scripts/`                     | Repository checks and build scripts, beside `scripts/github/`                                                    | Today, P-16                       |
| `scripts/github/`              | Idempotent scripts for labels, the sprint calendar, the board, the backlog and the wiki                          | Today                             |
| `docs/`                        | All documentation: `adr/`, `agile/`, `ai/`, `client/`, `design-thinking/`, `grs/`, `research/`, `team/` and more | Today, growing                    |
| `samples/`                     | Client samples tried on one machine. Git-ignored except its README. The ignore rule and the README exist         | Today                             |
| `assets-src/3d/`               | Parametric Blender scripts                                                                                       | Planned: P-23                     |
| `infra/deploy/`                | The server bootstrap, Caddy, `docker-compose.prod.yml` and backups                                               | Planned: P-24                     |
| `.github/`                     | Issue forms, the pull request template, `CODEOWNERS`, `labels.json`, `rulesets/main.json` and workflows          | Today                             |

Today's root files are `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.editorconfig`, `.gitattributes`, `.gitignore` and `.node-version`.

## 4. Engineering standards

These apply from the first line of code. The tooling that enforces them arrives with the stories named.

### OOP layers and patterns

The API is NestJS, in layers ([ADR 0008](docs/adr/0008-nestjs-layered-modules.md)). Controllers call services, and services call repositories and domain classes.

| Layer          | Its job                                                    | Its limit                       |
| -------------- | ---------------------------------------------------------- | ------------------------------- |
| Controllers    | Routes, guards, and request and response shapes            | No business rules               |
| Services       | Use cases and transactions                                 | No direct Prisma calls          |
| Repositories   | Reading and writing data                                   | The only place Prisma is called |
| Domain classes | Business rules, as classes that can be tested on their own | No HTTP and no Prisma           |

- Use a named pattern where it earns its place, and record it in [`docs/architecture/patterns.md`](docs/architecture/patterns.md).
- The plan already names these: repositories (built in P-8), a transactional outbox (P-15), a gateway over AI providers (P-17), a factory and an adapter for connectors (P-20), a Strategy interface for check rules (D-1), and the state machine Azri writes after C-1.
- On the web, shared behaviour lives in classes too: `ApiClient` (P-11) and `AnalyticsTracker` (G-1).
- Keep components under 200 lines, with one component per file.

### Types

- TypeScript in strict mode, as ESM.
- **No `any`.** Use `unknown` and narrow it with a zod schema or a type guard.
- Lint runs with no warnings allowed (`eslint --max-warnings 0`).

### Validation at boundaries

- Everything that crosses a boundary is untrusted until a zod schema has parsed it: request bodies, queries and params, environment variables, queue messages, webhooks, connector responses and model output.
- Schemas that both sides use live in `packages/shared` (planned: P-7).
- Inside the boundary, trust the types and don't validate twice.

### One error envelope

- Every API error has one shape: `{ error: { code, message, details, traceId } }`.
- The global exception filter produces it, and the codes live in `packages/shared`.
- The web app shows the `traceId` on its error state, so that a person can quote it.

### Comments that explain why

- A comment says why the code is this way: a constraint, a trap, a decision. The code itself says what it does.
- If code needs a comment to explain what it does, rename or simplify it first.

### Configuration

- Typed configuration, checked by a zod schema (`apps/api/src/config`).
- **One root `.env` is enough.** Load `apps/api/.env`, then the root `.env`, never overriding what the shell, CI or Docker set, and skipping missing files quietly. When something required is missing, the message names the file to create.
- `.env.example` is one root file documenting every variable with a safe default (planned: P-9).
- Ports come from `.env` (`POSTGRES_PORT`, `REDIS_PORT` and `MINIO_PORT`), and the URLs are built from them, so changing one line moves them all (planned: P-9).

## 5. Security

[`SECURITY.md`](SECURITY.md) says how to report a problem, and what runs today against what later stories bring.

- **Authorisation is enforced on the server.** Area 4's policy decides, and endpoints call it. The permissions guard calls the role-permission matrix, which area 4 owns (planned: P-10, F-1). Hiding a button is never the control. Every refusal is audited.
- **Sessions (planned: P-10):** argon2 password hashing; a JWT access token in an httpOnly, Secure, SameSite cookie; refresh-token rotation with reuse detection; CSRF protection.
- **API hardening:** helmet with a strict CSP, a CORS allow-list and rate limiting.
- **Financial controls (planned: F-1 is the base, and Angelyn builds the rules):** no self-approval, approval limits, bank-detail change control, and masking of bank details and prices by role, with a reason.
- **Audit (planned: P-9):** `AuditEvent` is append-only, held by a database trigger. The audit writer chains each event's hash to the one before it, verifies the chain, and joins the business transaction. Every sign-in, sign-out and change is audited (planned: P-10).
- **Uploads (planned: P-18):** PDF, PNG, JPEG, XLSX and CSV only, with size limits, type sniffing and a zip-bomb guard. Nothing executable is accepted.
- **AI (planned: P-17):** documents are treated as data, the model only returns fields, and no model output triggers an action. Area 4's policy decides what data may go to which provider, and the default is synthetic data only.
- **Keys:** licence keys live only in `apps/web/.env.local`, and AI keys only in the root `.env`. Richie puts them there himself. Never print, echo or ask for a key in chat.
- **Client samples:** `samples/*` is ignored today. The pre-commit and pre-push hooks guard them, and P-13 adds a throwaway stack that only this machine can reach, deleted afterwards.
- **Supply chain:** exact version pins; `minimumReleaseAge`; reviewed `allowBuilds`; overrides and ignored advisories, each with a reason and a review date; actions pinned to commit SHAs; least-privilege `permissions`.
- **Claims:** never claim the prototype is PDPA compliant.

## 6. Performance

- Route-level code splitting, with 3D and charts lazy-loaded.
- Pagination and an index for every query.
- LCP under 2.5 s, and Lighthouse 90 or more at each release.
- Initial JS of 250 KB gzip or less, 3D excluded. The bundle budget joins the verify job in P-11.
- For 3D: 1.5 MB or less of assets in total, a lazy chunk, DPR clamped to [1, 2], adaptive quality, paused when off-screen or when the tab is hidden, and 60 fps on a mid-range laptop, reported honestly (planned: P-23).
- A k6 smoke load test of the extraction queue and the order endpoints (planned, not yet in a story).

## 7. Testing

| Level           | What it covers                                                    | Tool                | Status                                 |
| --------------- | ----------------------------------------------------------------- | ------------------- | -------------------------------------- |
| Unit            | Domain logic, at 80% or more                                      | Vitest              | Today (P-8)                            |
| Scripts         | The pure logic of `scripts/github/`, against a simulated GitHub   | `node --test`       | Today, in `pnpm test`                  |
| API integration | Every endpoint, with 401, 403 and validation cases                | Vitest              | Planned: P-10, with its harness in P-9 |
| Component       | Components in each of their states                                | Testing Library     | Built: P-11                            |
| Contract        | Connectors against the mock                                       | Vitest              | Planned: P-20                          |
| End-to-end      | The smoke test first, then E2E #1 to #4, with WCAG 2.2 AA checked | Playwright with axe | Planned: P-14                          |
| Load            | The extraction queue and the order endpoints                      | k6                  | Planned, not yet in a story            |
| Manual requests | `.http` request files in `apps/api/requests/`                     | Any REST client     | Planned: P-8                           |

- Tests use synthetic data only.
- 100% of workflow tests pass. A failing test is fixed or reported, never skipped to get a green run.
- A safety test counts only after you have seen it fail against deliberately broken code.
- Area bases ship test skeletons as `it.todo` with the key cases named. Their owners fill them in.
- `docs/agile/test-plan.md` holds the test levels, environments, data, and the failure and edge-case matrix (P-6).

## 8. UI rules

These apply to all screens.

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

Planned with P-11:

- **Design tokens:** a warm neutral base with a deep jade accent; light and dark themes; an 8-pt spacing grid; radius and motion values; the Geist font, with tabular numbers.
- **UI sources while the repository is public:** shadcn/ui; Magic UI (free); React Bits (free, `@react-bits`); ReUI's free components, only if they install without the licence key.

[`CONTRIBUTING.md`](CONTRIBUTING.md) says how to add a component.

## 9. Git and AI rules

### Rules for every story

1. **One story, one issue, one branch, one pull request.**
   - Branch from the latest `main`.
   - The pull request closes its issue (`Closes #N`) and is merged with a merge commit once every required check is green.
   - The branch is then deleted and the story moves to Done.
2. **Names:** branches `feat/<area>-…`, `fix/…`, `docs/…`, `chore/…`, `ci/…` or `test/…`. Conventional Commits, small commits. Types: `feat`, `fix`, `docs`, `chore`, `ci`, `test`, `refactor`, `style`, `perf` and `build`.
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
5. **No AI attribution anywhere.** No Co-Authored-By trailers for AI, no "Generated with" lines, and no AI emojis or session links in commits, pull requests, comments or docs. `.claude/settings.json`, as Richie placed it, turns attribution off.
6. **No em dashes** in any file, commit, pull request or UI text. Use a hyphen, a colon or a new sentence. `pnpm check:dashes` and the hooks enforce this.
7. **Data and secrets:**
   - Synthetic data only.
   - Licence keys live only in `apps/web/.env.local`, and AI keys only in the root `.env`. Richie puts them there himself.
   - Never print, echo or ask for a key in chat.
8. **While the repository is public,** add no React Bits Pro or ReUI Pro code: their licences need a private repository. Richie tells you when it is private. Then check that the ruleset is still active and the wiki still opens, update `SECURITY.md`, `docs/security/security-testing.md` and `.github/rulesets/main.json` for what changed, and do P-22 once he says the keys are in place.
9. **Ask Richie first** before anything destructive or irreversible, and before any change to this plan.
10. **Honesty:** run the commands and report their real results. If something cannot be done, say so and propose the nearest alternative.

### The main branch

- The `Protect main` ruleset blocks deletion and force pushes, and requires a pull request: 0 approvals for now, stale reviews dismissed, review threads resolved, merge commits or squash. Repository admins can bypass it in pull request mode only. [`.github/rulesets/main.json`](.github/rulesets/main.json) mirrors it, and `scripts/github/check-ruleset.mjs` says if the two drift apart.
- Four checks are required: `Lint, typecheck, test, build`, `SAST (Semgrep)`, `Secret scan (gitleaks)` and `Dependency scan (OSV)`. P-13 and P-14 add theirs, and a required check's name stays fixed once it is required.
- One approving review plus code-owner review is switched on at T-9, only on Richie's yes.
- Never force push and never commit straight to `main`.
- Release tags are `v0.1-proposal`, `v0.2-technical-review` and `v1.0-final`, each after a feature freeze.

### Time

- One sprint is one week, Monday to Sunday. Sprint 1 is 26 Oct to 1 Nov 2026, the module's Week 2, and Sprint _n_ is module Week _n_ + 1.
- Sprints are a rhythm, not a limit. Work never waits for a sprint.
- The [working agreement](docs/agile/working-agreement.md) holds the sprint rules, the ceremonies, the work-in-progress limit and the reviewer of the day.
- If your context is compacted, or a new session picks the work up, re-read this file and `AGENTS.md`, work out where you are from the board, the open pull requests and `docs/BUILD_REPORT.md`, and carry on.

### AI tools

- Every teammate's AI tool follows [`AGENTS.md`](AGENTS.md).
- AI tool folders stay out of Git. `.claude/settings.json` is the one exception.
- `docs/ai/ai-usage-log.md` is the honest record of AI use, with prompts kept in `docs/ai/prompts/` (teammates use `areaN-NNN-…`). The module requires that record, and it is not attribution.
- The person who opens a pull request answers for all of it. Each member must be able to explain their own code at the Week 7 interview.

## 10. Definition of Done

A story is done when all of this is true. [The Definitions of Ready and Done](docs/agile/definitions-of-ready-and-done.md) hold the same list, plus the Definitions of Ready and the levels for each sprint and each assessment release.

1. Every acceptance criterion is met, with evidence in the pull request.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, and so does `docker compose up --build` once it exists. The pull request shows their real results.
3. New behaviour has tests at the right level, and domain logic stays at 80% or more unit coverage.
4. The story brought its own pieces: its models and migration, tests, `.env.example` entries and `.http` request files; an ADR if it made a decision; rows in the traceability matrix and `docs/architecture/patterns.md`; one row in the AI usage log.
5. UI changes handle every state, meet WCAG 2.2 AA, and have screenshots in light and dark from a Docker build of the branch, saved in `docs/design/screenshots/<area>/`.
6. The docs match what exists, and nothing claims to exist before it does.
7. No AI attribution, no em dashes, synthetic data only, no keys in Git and no AI tool folders.
8. Every required check is green and every review thread is resolved.
9. The pull request is merged with a merge commit, the branch is deleted, the issue is closed, and the story is at Done on the board, in the milestone of the week it finished.

Items that depend on something not yet built apply from the story that brings it. Until then, the pull request says so plainly.
