# ADR 0025: Area 3 reads order status through a port and ships mock routes

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** D-1

## Context

Area 3 shows every order's status, owner and overdue flag, and reports check results. Order status lives only in area 2's state machine, which does not exist yet. Area 3's owner needs screens and routes to build against this week, and must not start with a second, private idea of what a status is.

## Decision

1. **Status comes through one small interface.** `OrderStatusReader` (`apps/api/src/modules/checks/domain/order-status-reader.ts`) returns, for an order number, the status label and code area 2 reports, the role that holds the order and when it entered that status. A mock class answers from the synthetic data's sample states. When area 2's API exists, a class that calls it replaces the mock in `ChecksModule`. Nothing in area 3 branches on a status code, and the status codes are not enumerated in `packages/shared`.
2. **Area 3 reports to area 2 through a second port.** `CheckReporter` carries the `check.completed` event (pass or fail, the rule, the evidence). The contract is in `packages/shared`, and the base ships no implementation. Area 2's state machine decides what a failure holds up.
3. **The mock is labelled everywhere.** Every route answers `{ data, meta: { mock: true } }`, with the page meta beside it for lists. Each screen shows the Mock badge. Sample rule ids start with `mock.`, so a mock result cannot be mistaken for a real one.
4. **The mock data stays behind a repository.** `MockChecksRepository` is the only class that reads the synthetic dataset. Services call it, so a Prisma repository replaces it without touching them.
5. **Matching uses Navision numbers.** Customers and items are matched on their numbers. A name that looks alike but carries another number is listed as a possible match for a person to look at, and is never used as a match.
6. **The base writes no rule.** The check, tolerance, exceptions flow, tracker logic and KPI formulas are area 3's to write. The base's server-side paging, search and sort over mock rows exist only so the common data table works as it will with real data.

## Consequences

- Area 3's owner can build the real checks, exceptions and tracker while area 2's state machine is still being written, and swap the port when it lands.
- The two ports make the direction of the contract visible in the code: area 3 reads status and reports results, and never sets a status.
- Two classes (`MockOrderStatusReader`, `MockChecksRepository`) and the `mock-*` builders are throw-away code. They are small and named so that deleting them is a clean change.

## Alternatives considered

- **Store a status column in the tracker's own table.** Rejected: it would be a second source of truth, and the guide says area 3 keeps no status logic.
- **Enumerate area 2's statuses in `packages/shared` now.** Rejected: area 2 has not chosen them. A closed list written here would be guessed and would need undoing.
- **Hand-write the mock responses on the web side.** Rejected: the routes would not appear in Swagger, and the screens would not use the generated hooks that area 3's owner will keep.
