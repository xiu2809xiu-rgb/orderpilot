# OrderPilot

**AI reads, rules decide, people approve.**

OrderPilot is an AI-assisted order-automation layer beside Microsoft Dynamics Navision, never instead of it.

Spectra Innovations is a Singapore distributor of IT products and computer peripherals. Six groups handle every order by hand, re-typing data from POs, proforma invoices, invoices, packing lists and AWB/BL into Navision, then chasing approvals, payments and shipping papers. OrderPilot will read those documents, route the work to each role and track every order. A person will approve anything that matters, and that will be audited. The AI will never approve, buy, post, release goods or pay.

OrderPilot is our product for Problem Statement #11 in the IT2134 IT Innovation Project (SCCCI x NYP AI Innovation Challenge, AY2026 Semester 2). All its data is synthetic.

## Status

**The base is being built. There is no app to run yet.** This repository holds documents, configuration and the GitHub scripts, and the `pnpm` tooling, but no app and no `docker compose` stack so far.

### What works today

- **The ground rules:** this README, [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), the ADRs and the agile docs.
- **Repository files:** LF line endings, ignore rules for secrets, samples and AI tool folders, and the Node version.
- **GitHub as code:** issue forms, the pull request template, labels, the sprint milestones, the backlog, the board and the wiki, all kept as code in [`.github/`](.github/) and [`scripts/github/`](scripts/github/README.md), and a sprint recorder that files each finished story under its sprint.
- **The workspace and its checks:** `pnpm install`, then `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, with Git hooks that check every commit and refuse a push to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md).
- **CI and security scans:** the verify job, Semgrep, gitleaks and OSV run on every pull request and are required. See [security testing](docs/security/security-testing.md).
- **GitHub protection on `main`:** the `Protect main` ruleset, secret scanning with push protection, Dependabot alerts and security updates, and private vulnerability reporting.

### What later stories bring

| Stories                 | What they bring                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
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
- [SECURITY.md](SECURITY.md): how to report a problem, and what we scan.

**How we work**

- [Agile docs](docs/agile/README.md): the working agreement, the Definitions of Ready and Done, and the [backlog](docs/agile/backlog.md).
- [ADR 0001](docs/adr/0001-record-architecture-decisions.md): why we record decisions.
- [ADR 0002](docs/adr/0002-a-clean-repository-for-ps11.md): why this repository started clean.
- [ADR 0016](docs/adr/0016-github-process-as-code.md): why the GitHub process is code.

**The record**

- [AI usage log](docs/ai/ai-usage-log.md) and [Prompt 001](docs/ai/prompts/001-build-the-base.md).
- [Build report](docs/BUILD_REPORT.md).

**On GitHub**

- [Issues](https://github.com/xiu2809xiu-rgb/orderpilot/issues), [pull requests](https://github.com/xiu2809xiu-rgb/orderpilot/pulls) and [milestones](https://github.com/xiu2809xiu-rgb/orderpilot/milestones).
- [The board](https://github.com/xiu2809xiu-rgb/orderpilot/projects) and [the wiki](https://github.com/xiu2809xiu-rgb/orderpilot/wiki).
- [Report a vulnerability](https://github.com/xiu2809xiu-rgb/orderpilot/security/advisories/new).

The live demo arrives with P-24.
