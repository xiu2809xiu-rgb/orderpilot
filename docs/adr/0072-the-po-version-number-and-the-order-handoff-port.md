# ADR 0072: The PO version number and the order handoff port

- **Status:** Proposed. Azri reviews the port, and Angelyn reviews the files in the orders module.
- **Date:** 2026-11-26
- **Story:** [#404](https://github.com/xiu2809xiu-rgb/orderpilot/issues/404)

## Context

A customer who revises a PO sends a new PO that keeps the old number, and Spectra calls it version 2 of the same order (5 Nov briefing, assumption A-39). Area 2 builds what a new version does to the workflow: a hold, the payment gate, the checks already run. That waits on area 1's P-89, PO versions, and P-89 cannot be built yet: nothing submits an order made on the form, so no such order reaches the workflow.

This story is the part area 2 needs first. It fixes the name of the number and the one way area 1 tells the workflow that an order was submitted or revised. It adds no table, no route, no shared schema and no caller.

## Decision

1. **The name is `poVersionNo`**, an integer from 1. On screen it reads "PO version 2". The bare word `version` stays the order form's edit token (ADR 0047, decision 5), and `WorkflowInstance.version` and `WorkflowDefinition.version` are untouched. It is not `revision`, because the client and the brief both say "version 2 of the same order".
2. **One port, declared by area 1 and implemented by area 2.** `OrderHandoff` is an abstract class in `apps/api/src/modules/orders/domain/order-handoff.ts`, the way `ApprovalPolicy` and `WorkflowReadModel` are ports (ADR 0026). The consumer declares and the provider implements: here area 1 consumes, because area 1 makes the order and has to say what happened to it. Area 2 binds its class under the same token, in one line of `orders.module.ts`, and edits nothing else in area 1's files. Area 1 edits nothing under `modules/workflows`. Area 3's `ORDER_STATUS_READER` is the same idea with a Symbol token; an abstract class needs no token and gives a type to the implementation.
3. **Two calls**, each taking one typed fact and answering `{ effect: "none" | "applied" }`. `applied` means this call changed the order's workflow, and `none` means it changed nothing (a stand-in, no workflow, or a repeat).
   - `submitted(OrderSubmitted)`: `orderNo`, `customerNo`, `submittedBy`, `submittedAt`, `total`, `prepaymentPercent`, `poVersionNo` (1 at a submit) and `request`.
   - `poVersionConfirmed(PoVersionConfirmed)`: `orderNo`, `poVersionNo` (the new one), `supersedesPoVersionNo` (the one it replaces), `confirmedBy`, `confirmedAt`, `total` (the new one), `prepaymentPercent` and `request`.
   - `total` and `prepaymentPercent` are decimal strings, as everywhere else. `submittedBy` and `confirmedBy` are `{ userId, name, role }`. `request` is `{ ip, traceId }`.
4. **Two fields beyond the brief's list, because the workflow's own calls need them.** `OrderWorkflowService.start` and `apply` take an actor, the request's info and a time. The actor is `{ kind: "user", userId, name, role }` or a system name, and its `name` is required: it is written into the audit row's summary and into the event. So the person carries `name`, which area 1 has from the session and area 2 would otherwise look up. The info is `{ ip, traceId }`, which is written into every audit row `start`, `apply` and a refusal make, so the fact carries `request`. The time is `submittedAt` or `confirmedAt`. Nothing else was added. `customerNo` is not needed by `start` or `apply`; it is on the fact because the brief hands it over, so that area 2 need not read the order to name the customer on a task.
5. **What is left out, and why.** The lines and per-line prices (the workflow does not compare lines, and area 3's checks read the order), the stock (an order's own demand may already be netted in the available figure, so a boolean handed over from here could count it twice), and a prepayment amount. The payment gate's arithmetic is area 2's: it takes the total and the percent and works out the amount, as its seed does.
6. **The call runs inside area 1's transaction.** `Database.transaction` joins an open one. A `DomainError` thrown by the implementation rolls area 1's write back, and the person sees the implementation's message as the refusal.
7. **A repeated call is safe.** The same fact twice has the effect of once, and the second answer is `none`. Two `submitted` calls are the same when the order number is the same, and two `poVersionConfirmed` calls are the same when the order number and `poVersionNo` are the same. Area 2 keys its idempotency on exactly that.
8. **An order with no workflow answers `none` and does not throw.** This applies to `poVersionConfirmed`, for an order whose workflow was never started (`OrderWorkflowService.transition` would throw a not-found). `submitted` is the call that starts the workflow, so it has no such case.
9. **The stand-in is `LoggingOrderHandoff`, bound in `OrdersModule`.** It changes no status, answers `none`, and writes one log line that says it is a stand-in and that nothing was changed. The line holds the order number and the PO version number and nothing else: no total, no customer, no person.
10. **A contract test any implementation can run.** `describeOrderHandoffContract(name, factory)` is exported from `orders/domain/order-handoff.contract.ts` so that area 2 imports it in its own test. It checks decisions 7 and 8, the shape of the answer, that the fact is not edited, and that every refusal is a `DomainError`. It runs here against the stand-in, and `order-handoff.contract.test.ts` runs it against a small correct in-memory class that gives every optional part, so no check waits for area 2. The calls run for a Support user, for a Product Manager and with no prepayment due. A factory may also give `within`, which area 2 passes as its `database.transaction` and which every call then goes through, with a check that a refusal rolls back a write made just before it; `hasWorkflow`, with checks that a first `submitted` starts one and that a repeat leaves the one, and that an implementation that does nothing says so with `standIn: true`; and refusals. A part the factory leaves out is registered as a skipped test whose name says which part is missing. The file is left out of the production build.

## Consequences

- **Nothing calls the port today.** The submit story will call `submitted` when a person submits a draft, and P-89 will call `poVersionConfirmed` when a person confirms a re-sent PO. Until both are merged the port is declared, bound to the stand-in, and never called.
- **Only a submitted stored order will be revisable.** A draft is edited in place, a void order is closed, and a sample has no stored rows.
- **A known limit.** A revised PO with a new number never meets the duplicate rule, so it is stored as a separate order that nothing links to, until Spectra answers Q-43 (does a revised PO keep its number). The path built keeps the number.
- **Not built here: cancelling a submitted order.** That is P-50's, and it is expected to add a third call to this port. It is not designed here.
- **ADR 0047's duplicate rule is not amended here.** P-89 amends its decision 3 when it merges.
- **What area 2 must know when it implements the port.**
  - `OrderStateMachine.start` refuses a user actor who is not Support, so a Product Manager's submit starts the workflow as a system actor, and the machine then sets no `raisedByUserId`. The fact carries the person so that area 2 can keep it another way. The sales approval refuses an order without a `raisedByUserId` as "requester-unknown" (`sales-approval.service.ts`), so the start must take it from `submittedBy.userId`.
  - `OrderWorkflowRepository.insert` refuses a second start with a unique key. Inside an open transaction Postgres aborts the whole transaction on that error, so the implementation must read `statusOf` first and answer `none`, not rely on the conflict.
  - `AuthorisationService.enforce` throws inside a transaction, so a move that asks area 4's policy first cannot run inside this call. `apply` asks no policy.
  - A refusal's own audit row (`workflow.transition.refused`) joins the open transaction and is rolled back with area 1's write, so a refused handoff leaves no such row. Whether the refusal is audited is decided in the submit story, where the edge of the transaction is.

## Alternatives considered

- **An interface with a Symbol token, declared by area 2.** It is the pattern of `ApprovalOverdueNotifier` in pull request 372. Here the order is area 1's, so the consumer declares.
- **An event with an outbox.** P-15 is not built. A call inside the transaction gives a refusal that rolls back, which an event cannot.
- **`OrdersModule` injects `OrderWorkflowService` directly.** It would make area 1 the first caller of area 2's machine and decide its refusals. The port leaves them to area 2.
- **`revision` as the name.** The client and the brief say "version".
