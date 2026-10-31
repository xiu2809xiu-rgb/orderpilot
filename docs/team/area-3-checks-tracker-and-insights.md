# Area 3: Checks, tracker and insights

**Owner:** Iok Teck. **Backup:** Azri. **Capability:** D, with parts of E. Paths and reviewers are in [module ownership](module-ownership.md#area-3-checks-tracker-and-insights-iok-teck).

## Goal

Catch every disagreement between an order's documents before goods ship, and show every order in one place. Area 3 owns the checks engine and its tolerances, the check results and the exceptions queue, the tracker showing every order's complete history, and the KPIs, Spectra's five measures among them.

### User stories

- As the **warehouse**, I see a packing list whose quantity differs from the PO flagged before I ship, with both documents side by side.
- As **Support**, I work an exceptions queue: each exception says what differs, by how much, against which tolerance, and who should fix it.
- As **Support**, I can read a short explanation of an exception, written by AI and marked as such, with the logs as the source of truth.
- As **Management**, I open one tracker and see every order's status, owner, open actions, exceptions and overdue flags.
- As **anyone with the right**, I open an order and see its timeline: each step, who did it, when, and what it changed.
- As **Management**, I see Spectra's five measures as KPIs, with how each is calculated.

## Contracts

How area 3 meets the others ([How the areas connect](../../CLAUDE.md#how-the-areas-connect)). The event names below are proposals: P-7 drafts the order and event contract, and the team agrees it in Week 3, with every owner reviewing it.

| With   | Area 3 gives                                                                  | Area 3 takes                                                                                                                        |
| ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Area 1 | Requests for an AI explanation of an exception, through area 1's pipeline     | Documents and their confirmed fields, with confidence and source (`document.extracted`, `fields.confirmed`); master data and prices |
| Area 2 | Check results: `check.completed` with pass or fail, the rule and the evidence | Every status change and task event (`order.status-changed`, `task.overdue`), for the tracker                                        |
| Area 4 | Exceptions that need a controlled decision, such as a price override          | The policy's decision on who may see and resolve what; masking of prices                                                            |

- **Area 3 keeps no status logic.** It reads each order's status from area 2's events and shows it. A failed check is reported to area 2, whose state machine decides what the failure blocks.
- **Checks are fixed rules,** never AI. AI only explains an exception, and the explanation is labelled as AI.
- **Match on Navision numbers,** never on names or descriptions: customer No., item No., External Document No. ([data formats](../data-formats.md)).
- **Every tolerance is configuration,** with its value shown in each result.

## Recommended design

- **A Strategy for each check rule.** Each rule implements one interface: which documents it applies to, and an `evaluate` that returns a check result (rule, order, pass or fail, expected, actual, tolerance and links to the evidence). New rules are new classes, with no change to the engine.
- **The engine runs the rules** for an order when a document's fields are confirmed, collects the results, opens an exception for each failure and publishes `check.completed`.
- **The tracker is a read model.** It is built from area 2's events into a table designed for the tracker's queries, paged and indexed, so the tracker never computes status itself.
- **KPIs are formulas over events,** each documented with its definition, so that they match [the success metrics](../design-thinking/success-metrics.md).
- **Money is a value with its currency,** and comparisons state their rounding and tolerance.

The MVP mismatch, from upload to exception:

```mermaid
sequenceDiagram
  participant D as Area 1: documents
  participant C as Area 3: checks
  participant W as Area 2: workflows
  actor S as Support
  D-->>C: fields.confirmed (packing list)
  C->>C: Run the rules: packing list quantity against the PO
  C->>C: Fail: line 2 is 40, the PO says 50, tolerance 0
  C->>C: Open an exception, with the evidence
  C-->>W: check.completed (fail)
  W->>W: Decide what the failure blocks
  C-->>S: The exception in the queue
```

## What the base gives you

D-1 landed. Everything below runs today on mock data built from the synthetic data, and every answer says so in `meta.mock` and on screen with the Mock badge.

- **The checks module** (`apps/api/src/modules/checks/`):
  - `domain/check-rule.ts`: the `CheckRule` Strategy interface (`id`, `label`, `appliesTo`, `evaluate(context)`) and the context a rule is given. No rule is written.
  - `domain/order-status-reader.ts`: the `OrderStatusReader` port, the only way area 3 learns an order's status, and the `CheckReporter` port that carries `check.completed` to area 2. `mock-order-status-reader.ts` answers from the synthetic data's sample states. Area 2's API replaces it in `checks.module.ts`, and nothing else changes.
  - `domain/mock-samples.ts`, `domain/mock-status.ts`: the sample timelines, check results, exceptions and overdue flags the screens show. Every rule id starts with `mock.`. They go when your engine and read model exist.
  - `domain/name-match.ts`: lists look-alike names as possible matches. A match is made on the Navision number alone.
  - `mock-checks.repository.ts`, `tracker.service.ts`, `exceptions.service.ts` and the two controllers: layered as the platform expects. The services page, search and sort the mock list on the server and decide nothing else.
- **The insights module** (`apps/api/src/modules/insights/`): one route that returns Spectra's five measures with placeholder lab estimates.
- **The model** (`apps/api/prisma/schema/checks.prisma`, migration `20261101090000_checks_exceptions`): `CheckException`, empty. Nothing writes to it, and no order status is stored anywhere in area 3.
- **The contracts** (`packages/shared/src/checks.ts`): check result, evidence, tolerance, `check.completed`, exception (open and resolved only), the tracker row, the timeline, the master-data match and the five KPIs. Three new permissions: `tracker.read`, `exceptions.read` and `insights.read`, in the default role matrix that the seed loads.
- **Routes** (all in Swagger, `apps/api/requests/checks.http` has a request for each):

  | Route                          | Permission        | Returns                                                                  |
  | ------------------------------ | ----------------- | ------------------------------------------------------------------------ |
  | `GET /tracker/orders`          | `tracker.read`    | The tracker, with server-side paging, search, sort and an overdue filter |
  | `GET /tracker/orders/:orderNo` | `tracker.read`    | One order's timeline, check results and master-data matches              |
  | `GET /exceptions`              | `exceptions.read` | The exceptions queue, newest first, with paging and search               |
  | `GET /insights/kpis`           | `insights.read`   | The five measures, labelled as lab estimates                             |

- **Screens** (`apps/web/src/features/order-tracker/`, `exceptions/`, `insights/`), on the generated hooks and the common components, each with loading, empty, error with a trace id, and permission-denied states:
  - **The order tracker** (`/order-tracker`): the common data table with server-side paging, status, owner and overdue flags.
  - **An order's page** (`/order-tracker/:orderNo`): each step as a chain with its effect in our own words ("Payment confirmed: packing released"), the check results, the customer and items matched on Navision numbers (a look-alike name appears only as a possible match), and the operation log at the foot with mock rows until F-2 feeds it. Money postings stay in Navision, and the page says so.
  - **The exceptions queue** (`/exceptions`): what differs, by how much, against which tolerance, and who should fix it.
  - **The KPI dashboard** (`/insights`): the five measures, labelled as mock lab estimates, with a lazy-loaded chart for each and a table view. Screenshots, light and dark, are in `docs/design/screenshots/area-3/`.
- **Tests:** passing tests for the mock routes (unit, HTTP and component), and `it.todo` cases named for the MVP mismatch, tolerances, the exceptions flow and the KPI formulas in `domain/check-rules.todo.test.ts` and `insights/kpi-formulas.todo.test.ts`.
- **From the platform:** the shared contracts (P-7); the API shell (P-8); the database and seed orders in different states (P-9); sign-in and the permissions guard (P-10); the web shell (P-11) and the common data table, page states and operation log (P-12); the event bus and live updates (planned: P-15); mock Navision's master data (planned: P-19); and the synthetic documents with planted mistakes (planned: P-21).
- **Generated hooks and mocks (P-26):** the screens use the typed TanStack Query hooks and MSW handlers that orval generates (`useTrackerList`, `useTrackerTimeline`, `useExceptionsList`, `useInsightsKpis`). Run `pnpm api:generate` when your routes change; CI fails when the output is out of date. See [ADR 0025](../adr/0025-area-3-reads-status-through-a-port.md) for the design.

## What's yours to build

D-1 left all of this to you: every check and its tolerance, the exceptions flow, the tracker's logic and the KPIs.

**Starter stories,** ready to pull on the board:

- **D-2: the packing-list quantity check against the PO,** the Must mismatch. Write the first `CheckRule`, a small engine that runs the rules for an order, and the tolerance configuration. Replace the `it.todo` cases in `check-rules.todo.test.ts`.
- **D-3: the exceptions queue flow:** open, assign, resolve or escalate, with every step audited. Start from the empty `CheckException` model and the queue screen.
- **D-4: the tracker's status, owner and overdue flags,** from area 2's workflow events. Replace `MockOrderStatusReader` with a read model, and the mock overdue flag with your rule.

**Deliberately left out of the base** (each is on the backlog under D-3 or D-4):

- every check rule, tolerance and the engine that runs them, and what a check reports to area 2 (`CheckReporter` has no implementation);
- the exceptions flow: states beyond open and resolved, assignment, escalation, due times and audit;
- the tracker's logic: statuses from events, owners, overdue rules and open actions;
- the KPI formulas, trends over a period and real figures (the five measures are fixed mock lab estimates);
- the documents shown side by side with the differing line marked, role home tiles with counts, the operation log fed from the audit trail (F-2), and an end-to-end spec.

**The deeper work,** for the A-level depth:

- full matching (Should 3): the PO compared with the PI, invoice, packing list and AWB/BL, line by line;
- more rules (Should 6): prices against the customer's price group, currency, totals, PO references, part numbers and stock;
- partial shipments and substitutions, once Spectra says how they work (Q-8);
- the AI explanation of each exception, through area 1's gateway, labelled as AI;
- the KPIs: each of the five measures as a tested formula, with its lab estimate labelled;
- full test coverage: every planted mistake in the synthetic documents flagged, and no false alarm on the clean ones.

## Options to consider, not built

Tools that may suit this area. None is installed, pinned or built ([ADR 0020](../adr/0020-options-left-to-the-owners.md)). If you adopt one, bring its ADR, an exact pinned version and a row in the traceability matrix with that story.

- **json-rules-engine** for the check rules. The plan is plain check classes with data-driven settings; adopt the library only if it makes rules easier to read and to change than that.

## At the Week 7 interview

Be ready to explain, in your own code:

- how the Strategy interface lets a new rule be added without changing the engine;
- how a tolerance is set, applied and shown;
- why area 3 keeps no status logic, and how the tracker stays current from events;
- how an exception moves through the queue, and who may resolve it;
- how each KPI is calculated, and why the lab estimates are labelled as such;
- how your tests prove that every planted mismatch is caught.

## Risks

| Risk                                                          | What to do                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Too many false alarms, so people ignore the queue             | Start strict on quantity only; add tolerances from Spectra's answers (Q-8)     |
| A mismatch is missed because names, not numbers, were matched | Match on Navision numbers only; test look-alike names                          |
| The tracker drifts from area 2's real status                  | Build it only from events; rebuild the read model from the event log in a test |
| KPIs are read as real results                                 | Label every lab estimate; record the protocol and the sample size              |
| Slow queries as orders grow                                   | Page and index every list; test with the full synthetic set                    |

## Module requirements

| Requirement           | How area 3 covers it                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| M1 Design thinking    | The tracker answers "where is my order?" (HMW-6, HMW-9), and the five measures            |
| M2 GRS by design      | Mismatches caught before shipping, fewer reshipments, and audited exception decisions     |
| M3 AI-assisted coding | AI explanations labelled as AI; prompts kept as `area3-NNN-…`; rows in the AI usage log   |
| M4 Best practices     | Rules as tested Strategies, paged and indexed queries, and tests against planted mistakes |
| M5 Team Git workflow  | Stories on the board, one branch and pull request each, reviews within a day              |
| M6 Deploy and monitor | The KPI dashboard, and overdue orders visible on the tracker                              |
