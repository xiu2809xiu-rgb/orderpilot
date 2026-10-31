# Definition of Done

A story is done when all of this is true. The repository holds the [same list](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/CLAUDE.md#10-definition-of-done), plus the [Definitions of Ready and the levels for each sprint and each assessment release](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/docs/agile/definitions-of-ready-and-done.md).

1. Every acceptance criterion is met, with evidence in the pull request.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass, and so does `docker compose up --build` once it exists. The pull request shows their real results.
3. New behaviour has tests at the right level, and domain logic stays at 80% or more unit coverage.
4. The story brought its own pieces: its models and migration, tests, `.env.example` entries and `.http` request files; an ADR if it made a decision; rows in the traceability matrix and `docs/architecture/patterns.md`; one row in the AI usage log.
5. UI changes handle every state, meet WCAG 2.2 AA, and have screenshots in light and dark from a Docker build of the branch, saved in `docs/design/screenshots/<area>/`.
6. The docs match what exists, and nothing claims to exist before it does.
7. No AI attribution, no em dashes, synthetic data only, no keys in Git and no AI tool folders.
8. Every required check is green and every review thread is resolved.
9. The pull request is merged with a merge commit, the branch is deleted, the issue is closed, and the story is at Done on the board, in the milestone of the week it finished.

Items that depend on something not yet built apply from the story that brings it: no `pnpm` command exists until P-5, and the traceability matrix and patterns file arrive in P-3 and P-8. Until then, the pull request says so plainly.
