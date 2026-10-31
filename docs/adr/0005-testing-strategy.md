# ADR 0005: The testing strategy

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-6

## Context

OrderPilot's promise is "AI reads, rules decide, people approve". The rules and the refusals are the product: a wrong approval limit, a missed mismatch or a payment released before Finance confirms it is worse than a crash. The targets ask for 100% of workflow tests passing, every seeded mismatch flagged and no duplicate orders, and the module marks testing under M4.

Four owners will write tests in parallel, each in their own area, and each must explain theirs at the Week 7 interview. CI minutes are limited once the repository is private.

## Decision

1. **The test levels, each with its tool:**

   | Level           | Tool                                                     | What it proves                                                        | Story                         |
   | --------------- | -------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------- |
   | Repository      | `node --test`                                            | The guards, hooks and GitHub scripts behave, against real Git repos   | Today (P-5, P-2)              |
   | Unit            | Vitest                                                   | Domain classes and rules, 80% or more coverage on domain logic        | P-8, then every story         |
   | API integration | Vitest against a real PostgreSQL, Redis and MinIO        | Every endpoint, with 401, 403 and validation cases, and audit entries | P-10, with its harness in P-9 |
   | Component       | Vitest with Testing Library                              | Each component in each of its states                                  | P-11                          |
   | Contract        | Vitest                                                   | Connectors against the mock Navision                                  | P-20                          |
   | End-to-end      | Playwright with axe                                      | The smoke test, then E2E #1 to #4, with WCAG 2.2 AA checked           | P-14                          |
   | Load            | k6                                                       | The extraction queue and the order endpoints, a smoke load only       | Planned, not yet in a story   |
   | Manual          | `.http` request files                                    | Each endpoint by hand, for reviews and demos                          | P-8                           |
   | Security        | Semgrep, gitleaks, OSV, `pnpm audit`, then Trivy and ZAP | ADR 0006                                                              | P-6, P-13, P-24               |

2. **The repository's own scripts use Node's built-in runner.** They are plain Node with no dependencies, so `node --test` needs nothing installed. Vitest arrives with the first app (P-8) and is used for all app code from then on.
3. **Rules are tested where they live.** A rule in a domain class gets unit tests for its edges. An endpoint gets an integration test that it calls the rule and refuses what the rule refuses. The UI hiding a button is never the test of a permission.
4. **A safety test counts only after it has been seen failing** against a deliberately broken copy of the code. The guards in P-5 were checked this way, and every safety test later is too.
5. **Synthetic data only**, from `packages/synthetic-data` (P-9) and `packages/synthetic-documents` (P-21), with fixed seeds so a failure reproduces.
6. **Failing tests are fixed or reported, never skipped** to get a green run. An area base ships `it.todo` skeletons with the key cases named, and its owner fills them in. A `todo` is visible in the report; a skipped test is not allowed.
7. **CI runs every level that exists** in the verify job, the integration tests against service containers, and the end-to-end tests on the Docker build (P-14). Heavy jobs may skip with job-level conditions when nothing they cover changed; a skipped job still passes its check.
8. **The test plan** ([`docs/agile/test-plan.md`](../agile/test-plan.md)) holds the environments, the data, and the failure and edge-case matrix. Each case names its story and is marked planned until a test covers it.

## Consequences

- The rules that matter most get the fastest, most numerous tests, and the slow end-to-end tests stay few: one smoke test and the four journeys.
- Integration tests need the Docker services locally, which makes them slower to run, and they are where the 401 and 403 cases live.
- Two runners exist: `node --test` for the repository scripts and Vitest for app code. The root `pnpm test` runs both, so nobody has to remember which.
- Seeing each safety test fail first takes a few minutes per guard, and it is the only way to know the test tests anything.
