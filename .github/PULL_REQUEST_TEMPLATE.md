<!--
Keep every heading. Where a section does not apply, write "n/a" and why.
Report real results only: a skipped step is reported as skipped, never as passed.
-->

Closes #

## What and why

## Area

- [ ] `area: 1 document AI and integration`
- [ ] `area: 2 order workflows and approvals`
- [ ] `area: 3 checks tracker and insights`
- [ ] `area: 4 controls and monitoring`
- [ ] `area: team`

## Module requirements

Every feature traces to at least one of these.

- [ ] `req: M1 design thinking`
- [ ] `req: M2 GRS by design`
- [ ] `req: M3 AI-assisted coding`
- [ ] `req: M4 best practices`
- [ ] `req: M5 team Git workflow`
- [ ] `req: M6 deploy and monitor`

## Acceptance criteria and evidence

| Criterion | Evidence |
| --------- | -------- |
|           |          |

## Results

Paste what really happened. Before a command exists, say so.

| Command                     | Result |
| --------------------------- | ------ |
| `pnpm lint`                 |        |
| `pnpm typecheck`            |        |
| `pnpm test`                 |        |
| `pnpm build`                |        |
| `docker compose up --build` |        |

## UI checklist

For UI changes only. Otherwise write "n/a".

- [ ] Screenshots in light and dark from a Docker build of this branch, saved in `docs/design/screenshots/<area>/`
- [ ] Every state is handled: loading, empty, error with retry and a trace id, partial, success and permission denied
- [ ] WCAG 2.2 AA: contrast of 4.5:1 or more, visible focus, full keyboard use, ARIA labels and reduced motion
- [ ] Design tokens only, Lucide icons only, at most one primary button in a view, and no hard-coded strings
- [ ] GRS is visible where it applies: classification badges, masked fields with a reason, audit links, approval steps and AI confidence with "Requires approval"

## Docs

- [ ] The docs match what exists, and nothing claims to exist before it does
- [ ] An ADR, if this made a decision
- [ ] Rows in the traceability matrix and `docs/architecture/patterns.md`, where they apply
- [ ] One row in `docs/ai/ai-usage-log.md`
- [ ] The story's line in `docs/BUILD_REPORT.md`

## Data and security

- [ ] Synthetic data only, and no Spectra document
- [ ] No key in Git, in a log or in this pull request
- [ ] No AI tool folders, no AI attribution and no em dashes
- [ ] Authorisation is enforced on the server, and every refusal is audited, where this touches an endpoint
- [ ] Input crossing a boundary is parsed by a zod schema, where this adds a boundary
- [ ] No React Bits Pro or ReUI Pro code while the repository is public

## Definition of Done

The full list is in [the Definition of Done](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/CLAUDE.md#10-definition-of-done).

- [ ] Every acceptance criterion is met, with evidence above
- [ ] New behaviour has tests at the right level, and domain logic stays at 80% or more unit coverage
- [ ] The story brought its own pieces: models and migration, tests, `.env.example` entries and `.http` request files, where they apply
- [ ] Every required check is green and every review thread is resolved
- [ ] It will be merged with a merge commit, and the branch deleted
