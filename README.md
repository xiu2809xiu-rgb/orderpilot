# OrderPilot

**AI reads, rules decide, people approve.**

OrderPilot is an AI-assisted order-automation layer beside Microsoft Dynamics Navision, never instead of it.

Spectra Innovations is a Singapore distributor of IT products and computer peripherals. Six groups handle every order by hand, re-typing data from POs, proforma invoices, invoices, packing lists and AWB/BL into Navision, then chasing approvals, payments and shipping papers. OrderPilot reads those documents, routes the work to each role and tracks every order. A person approves anything that matters, and that is audited. The AI never approves, buys, posts, releases goods or pays.

OrderPilot is our product for Problem Statement #11 in the IT2134 IT Innovation Project (SCCCI x NYP AI Innovation Challenge, AY2026 Semester 2). All its data is synthetic.

## Status

**The base is being built. There is no app to run yet.** This repository holds documents and configuration only, with no `pnpm` commands and no `docker compose` stack so far.

### What works today

- **The ground rules:** this README, [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), the ADRs and the agile docs.
- **Repository files:** LF line endings, ignore rules for secrets, samples and AI tool folders, and the Node version.
- **GitHub protection on `main`:** the `Protect main` ruleset, secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting.

### What later stories bring

| Stories                 | What they bring                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| P-2                     | Issue forms, the pull request template, labels, the backlog and board as code, and the wiki pages   |
| P-3, P-4                | The problem statement, research, client questions, and a guide for each area                        |
| P-5, P-6                | The pnpm workspace, `pnpm` commands, Git hooks, CI and security scans                               |
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
- [SECURITY.md](SECURITY.md): how to report a problem, and what we scan.

**How we work**

- [Agile docs](docs/agile/README.md): the working agreement and the Definitions of Ready and Done.
- [ADR 0001](docs/adr/0001-record-architecture-decisions.md): why we record decisions.
- [ADR 0002](docs/adr/0002-a-clean-repository-for-ps11.md): why this repository started clean.

**The record**

- [AI usage log](docs/ai/ai-usage-log.md) and [Prompt 001](docs/ai/prompts/001-build-the-base.md).
- [Build report](docs/BUILD_REPORT.md).

**On GitHub**

- [Issues](https://github.com/xiu2809xiu-rgb/orderpilot/issues) and [pull requests](https://github.com/xiu2809xiu-rgb/orderpilot/pulls).
- [Report a vulnerability](https://github.com/xiu2809xiu-rgb/orderpilot/security/advisories/new).

The board and the wiki pages arrive with P-2, and the live demo with P-24.
