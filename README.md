# OrderPilot

**AI reads, rules decide, people approve.**

OrderPilot is an AI-assisted order-automation layer beside Microsoft Dynamics Navision, never instead of it.

Spectra Innovations is a Singapore distributor of IT products and computer peripherals. Six groups handle every order by hand, re-typing data from POs, proforma invoices, invoices, packing lists and AWB/BL into Navision, then chasing approvals, payments and shipping papers. OrderPilot will read those documents, route the work to each role and track every order. A person will approve anything that matters, and that will be audited. The AI will never approve, buy, post, release goods or pay.

OrderPilot is our product for Problem Statement #11 in the IT2134 IT Innovation Project (SCCCI x NYP AI Innovation Challenge, AY2026 Semester 2). All its data is synthetic.

## Project layout

| Folder              | What it holds                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`          | The front end: the React web app                                                                                             |
| `apps/api`          | The back end: the NestJS API and its worker, with the Prisma schema and migrations                                           |
| `apps/e2e`          | The end-to-end tests: Playwright against the running stack                                                                   |
| `packages`          | Shared code: the contracts both sides use, the synthetic data and documents, and the TypeScript and ESLint settings          |
| `services`          | The mock services that stand in for outside systems: today the template each one starts from (mock Navision comes with P-19) |
| `docker`, `scripts` | Tooling: the Dockerfiles that are not an app's own, the repository checks and the GitHub scripts                             |
| `docs`              | The documentation: decisions, architecture, the agile docs, the team guides and the build report                             |

Which folders belong to each of the four areas:

| Area                                           | Its folders                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Document AI and integration (Richie)        | The platform in `apps/api/src/` (sign-in, users, health, storage, queues and the rest), `apps/api/src/modules/master-data/`, the web app's shell and common components, the web features for documents, orders, master data, connectors, mapping and the 3D view, `packages/synthetic-data/`, `packages/synthetic-documents/`, `services/` and `apps/e2e/` |
| 2. Order workflows and approvals (Azri)        | `apps/api/src/modules/workflows/`, `apps/web/src/features/workflows/` and `workflows.prisma`                                                                                                                                                                                                                                                               |
| 3. Checks, tracker and insights (Iok Teck)     | `apps/api/src/modules/checks/` and `insights/`, `apps/web/src/features/order-tracker/`, `exceptions/` and `insights/`, and `checks.prisma`                                                                                                                                                                                                                 |
| 4. Controls, security and monitoring (Angelyn) | `apps/api/src/modules/governance/`, `audit/`, `analytics/` and `monitoring/`, `apps/web/src/features/governance/`, `audit/` and `monitoring/`, and `governance.prisma` and `analytics.prisma`                                                                                                                                                              |
| Shared by all four                             | `packages/shared/`, `packages/tsconfig/`, `packages/eslint-config/`, `.github/`, `docs/`, `scripts/`, `docker/` and the files at the root                                                                                                                                                                                                                  |

[Module ownership](docs/team/module-ownership.md) lists every path and who reviews it, and [`.github/CODEOWNERS`](.github/CODEOWNERS) applies it on GitHub. [The architecture](docs/architecture/README.md) explains how the API is built and how to add to it.

## Status

**The base is being built. There is no app to run yet.** This repository holds documents, configuration and the GitHub scripts, and the `pnpm` tooling, but no app and no `docker compose` stack so far.

### What works today

- **The ground rules:** this README, [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), the ADRs and the agile docs.
- **The problem and the areas:** [the problem statement](docs/problem-statement.md), research, client questions, design thinking, GRS, and [who owns what](docs/team/module-ownership.md), with a guide for each area.
- **Repository files:** LF line endings, ignore rules for secrets, samples and AI tool folders, and the Node version.
- **GitHub as code:** issue forms, the pull request template, labels, the sprint milestones, the backlog, the board and the wiki, all kept as code in [`.github/`](.github/) and [`scripts/github/`](scripts/github/README.md), and a sprint recorder that files each finished story under its sprint.
- **The workspace and its checks:** `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, with Git hooks that check every commit and refuse a push to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **CI and security scans:** the verify job, Semgrep, gitleaks and OSV run on every pull request and are required. See [security testing](docs/security/security-testing.md).
- **GitHub protection on `main`:** the `Protect main` ruleset, and Dependabot alerts and security updates. The repository is private, so GitHub's secret scanning and private vulnerability reporting are off; [SECURITY.md](SECURITY.md) says what covers them.

### What later stories bring

| Stories                 | What they bring                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| P-2                     | Issue forms, the pull request template, labels, the backlog and board as code, and the wiki pages   |
| P-3, P-4                | The problem statement, research, client questions, and a guide for each area                        |
| P-7 to P-16             | The app: shared contracts, API, database, sign-in, web shell, Docker images, events and diagrams    |
| P-17 to P-21            | The core of area 1: the AI gateway, document intake, mock Navision, connectors, synthetic documents |
| C-1, D-1, F-1, F-2, G-1 | A head start for areas 2, 3 and 4                                                                   |
| P-22 to P-25            | The design system once the repository is private, the 3D scene, deployment and the slides           |

[The build report](docs/BUILD_REPORT.md) tracks each story as it lands.

## The team

| Area                                 | Owner    |
| ------------------------------------ | -------- |
| 1. Document AI and integration       | Richie   |
| 2. Order workflows and approvals     | Azri     |
| 3. Checks, tracker and insights      | Iok Teck |
| 4. Controls, security and monitoring | Angelyn  |

Richie, the team lead, builds the base for every area. Each owner then takes over their own.

## Links

**Start here**

- [CLAUDE.md](CLAUDE.md): the product brief, stack, standards, UI rules and Definition of Done.
- [CONTRIBUTING.md](CONTRIBUTING.md): set-up, workflow and how to add a component.
- [AGENTS.md](AGENTS.md): the rules for every AI tool, and a starter prompt.
- [SECURITY.md](SECURITY.md): how to report a problem, privately, and what we scan.

**How we work**

- [Agile docs](docs/agile/README.md): the working agreement, the Definitions of Ready and Done, and the [backlog](docs/agile/backlog.md).
- [ADR 0001](docs/adr/0001-record-architecture-decisions.md): why we record decisions.
- [ADR 0002](docs/adr/0002-a-clean-repository-for-ps11.md): why this repository started clean.
- [ADR 0016](docs/adr/0016-github-process-as-code.md): why the GitHub process is code.
- [ADR 0023](docs/adr/0023-exceljs-for-table-export.md): why Excel export uses ExcelJS, loaded on demand.

**The record**

- [AI usage log](docs/ai/ai-usage-log.md) and [Prompt 001](docs/ai/prompts/001-build-the-base.md).
- [Build report](docs/BUILD_REPORT.md).

**On GitHub**

- [Issues](https://github.com/xiu2809xiu-rgb/orderpilot/issues), [pull requests](https://github.com/xiu2809xiu-rgb/orderpilot/pulls) and [milestones](https://github.com/xiu2809xiu-rgb/orderpilot/milestones).
- [The board](https://github.com/xiu2809xiu-rgb/orderpilot/projects) and [the wiki](https://github.com/xiu2809xiu-rgb/orderpilot/wiki).

The live demo arrives with P-24.
