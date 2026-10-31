# Module ownership

Who owns which part of OrderPilot, and who reviews changes to it. 85% of the marks are individual, so every path has one owner, and each owner can explain their own code at the Week 7 interview.

- **Write only in your own area** ([AGENTS.md, rule 2](../../AGENTS.md#2-write-only-in-your-own-area)). If a task needs a change in another area, the owner of that area makes it or reviews it.
- **Shared files change in small pull requests,** with the affected owners asked to review.
- **After the handover,** Richie leaves each area's folders alone. Until then he builds each area's base (C-1, D-1, F-1, F-2 and G-1), never its core logic.

Most paths below do not exist yet. They are the planned layout, consistent with [the repository layout in CLAUDE.md](../../CLAUDE.md#3-repository-layout). The story that creates a path may adjust it, and updates this file in the same pull request.

## Owners

| Area                                 | Owner    | Backup owner | Guide                                                      |
| ------------------------------------ | -------- | ------------ | ---------------------------------------------------------- |
| 1. Document AI and integration       | Richie   | Angelyn      | [Area 1 guide](area-1-document-ai-and-integration.md)      |
| 2. Order workflows and approvals     | Azri     | Iok Teck     | [Area 2 guide](area-2-order-workflows-and-approvals.md)    |
| 3. Checks, tracker and insights      | Iok Teck | Azri         | [Area 3 guide](area-3-checks-tracker-and-insights.md)      |
| 4. Controls, security and monitoring | Angelyn  | Richie       | [Area 4 guide](area-4-controls-security-and-monitoring.md) |

T-1 named a backup owner for each area (Azri and Iok Teck back each other up, Angelyn backs up area 1 and Richie backs up area 4) and filled [`.github/CODEOWNERS`](../../.github/CODEOWNERS), so that every path has at least two owners and nobody waits on their own approval: each area's paths go to its owner, its backup and Richie (area 1: Richie and Angelyn), and shared files go to all four. The handles are `xiu2809xiu-rgb` (Richie), `MaineJermaine` (Azri), `ITnyp` (Iok Teck) and `angelynnmr` (Angelyn).

## The paths each area owns

Conventions for every area:

- **API module:** `apps/api/src/modules/<module>/`, with its controllers, services, repositories and domain classes, and its unit tests (`*.spec.ts`) beside them.
- **Prisma schema:** the area's own file in `apps/api/prisma/schema/` (a multi-file schema, planned: P-9). Each migration belongs to the area whose schema it changes.
- **API integration tests:** `apps/api/test/<module>.int-spec.ts`. **Request files:** `apps/api/requests/<module>.http`.
- **Web feature:** `apps/web/src/features/<feature>/`, with its pages, components, hooks and component tests (`*.test.tsx`). Its `index.ts` exports one `defineFeature` object (path, menu entry, permission, role home tiles, lazy page), and `features/registry.ts` lists it: that one line is the only change outside the folder. [ADR 0013](../adr/0013-the-web-stack.md) has the details.
- **Text:** the area's own i18n namespace, `apps/web/src/locales/en/<namespace>.json`, loaded lazily.
- **End-to-end tests:** `apps/web/e2e/<feature>.spec.ts`.
- **Docs:** the area's guide in `docs/team/`, its rows in the shared tables, and its prompts in `docs/ai/prompts/` as `areaN-NNN-…`.

### Area 1: Document AI and integration (Richie)

| Kind                  | Paths                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API modules           | `documents`, `orders`, `master-data`, `connectors`, `mapping`, `ai`, and the platform modules: `auth`, `users`, `health`, `storage`, `queue`, `events`, `templates` |
| Prisma schema         | `documents.prisma`, `orders.prisma`, `master-data.prisma`, `connectors.prisma`, `ai.prisma`, `platform.prisma`                                                      |
| Web features          | `documents`, `orders`, `master-data`, `connectors`, `mapping`, `constellation`                                                                                      |
| Services and packages | `services/mock-navision/`, `packages/synthetic-data/`, `packages/synthetic-documents/`                                                                              |
| Other                 | `assets-src/3d/`, `apps/web/public/demo-documents/`                                                                                                                 |

### Area 2: Order workflows and approvals (Azri)

| Kind          | Paths                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| API module    | `workflows`: the state machine, workflow definitions and instances, tasks, SPR approval, the payment gate, reminders, escalations and notifications |
| Prisma schema | `workflows.prisma`                                                                                                                                  |
| Web feature   | `workflows`: the task inbox, an order's steps and timeline, the SPR approval page and reminders                                                     |
| Tests         | `apps/api/test/workflows.int-spec.ts`, `apps/web/e2e/workflows.spec.ts`                                                                             |

### Area 3: Checks, tracker and insights (Iok Teck)

| Kind          | Paths                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API modules   | `checks`: the check rules, check results and exceptions; `insights`: the KPIs                                                  |
| Prisma schema | `checks.prisma`                                                                                                                |
| Web features  | `order-tracker`: the tracker and an order's detail timeline; `exceptions`: the exceptions queue; `insights`: the KPI dashboard |
| Tests         | `apps/api/test/checks.int-spec.ts`, `apps/web/e2e/order-tracker.spec.ts`                                                       |

### Area 4: Controls, security and monitoring (Angelyn)

| Kind          | Paths                                                                                                                                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API modules   | `governance`: the authorisation policy, the role-permission matrix, approval limits, segregation of duties, the bank-detail control, masking, classification and the rules for data sent to AI; `audit`: the audit viewer, export and retention; `analytics`: clickstream; `monitoring`: telemetry and `/metrics` |
| Prisma schema | `governance.prisma`, `analytics.prisma`                                                                                                                                                                                                                                                                           |
| Web features  | `governance`: the role-permission matrix screen; `audit`: the audit log viewer; `monitoring`: AI usage and cost, observability and clickstream                                                                                                                                                                    |
| Web class     | `AnalyticsTracker`, in `apps/web/src/features/monitoring/`                                                                                                                                                                                                                                                        |
| Tests         | `apps/api/test/governance.int-spec.ts`, `apps/web/e2e/governance.spec.ts`, including E2E #3                                                                                                                                                                                                                       |

## Shared files and who reviews them

A shared file is one that more than one area depends on. Its change goes in a small pull request of its own where possible.

| Shared                                                                                                                                                  | Maintained by | Also reviewed by                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| The order and event contract in `packages/shared` (planned: P-7)                                                                                        | Richie        | **All four owners**: agreed together in Week 3                                      |
| The rest of `packages/shared`: envelopes, error codes, roles, permissions                                                                               | Richie        | The owner whose area uses the changed part                                          |
| The audit writer and the `AuditEvent` model (planned: P-9)                                                                                              | Richie        | Angelyn                                                                             |
| The permissions guard (planned: P-10), which calls area 4's policy                                                                                      | Richie        | Angelyn                                                                             |
| `AiUsageTracker` and `AiUsageRecord` (planned: P-17), which area 4's screens read                                                                       | Richie        | Angelyn                                                                             |
| The template engine (area 1's story), used by area 2's documents and area 3's reports                                                                   | Richie        | Azri, Iok Teck                                                                      |
| The domain event bus and outbox (planned: P-15)                                                                                                         | Richie        | Azri, Iok Teck                                                                      |
| `apps/api/src/app.module.ts`, `main.ts` and the configuration schema                                                                                    | Richie        | The owner whose module is added                                                     |
| `apps/api/prisma/migrations/` (the folder; each migration is its area's)                                                                                | Richie        | The owner of the schema it changes                                                  |
| `apps/web/src/app/`: the router, the shell, the sidebar and the role home pages                                                                         | Richie        | The owner whose routes or menu entries change                                       |
| `apps/web/src/components/`: the common components (planned: P-12), design tokens and the common i18n namespace                                          | Richie        | Any owner who asked for the change                                                  |
| Tooling: root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/tsconfig`, `packages/eslint-config`, formatter and commit-lint configs | Richie        | Backup owners                                                                       |
| `.github/`: workflows, issue forms, the pull request template, [`CODEOWNERS`](../../.github/CODEOWNERS), `labels.json`, `rulesets/`                     | Richie        | Backup owners                                                                       |
| `docker-compose*.yml`, the Dockerfiles, `.env.example`, `infra/`, `scripts/`                                                                            | Richie        | The owner whose service or variable changes                                         |
| `CLAUDE.md`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`                                                                                 | Richie        | All owners, for a change to a rule                                                  |
| Shared tables: `docs/BUILD_REPORT.md`, `docs/ai/ai-usage-log.md`, `docs/requirements-traceability.md`, `docs/architecture/patterns.md`                  | Richie        | Each owner adds rows for their own work. On a merge conflict, keep both sides' rows |
| `docs/adr/`                                                                                                                                             | The author    | Richie, and the owner of any area the decision affects                              |
| The area guides in `docs/team/`                                                                                                                         | Each owner    | Richie                                                                              |

## How the areas meet

The contracts between the areas are in each guide's **Contracts** section. In short:

- **Only area 2's state machine holds order status.** The order's data and documents are area 1's; area 3 reads the status and computes none itself.
- **Area 3 sends its check results to area 2,** whose state machine decides what a failed check holds up.
- **Area 4's policy is enforced on the server.** Endpoints call it, through area 1's guard.
- **The AI pipeline stays whole in area 1.** Area 4 sets what data may go to which AI provider, and audits the AI's decisions.
- **The order and event contract** is drafted in P-7 and agreed by the team in Week 3, with every owner reviewing it.
