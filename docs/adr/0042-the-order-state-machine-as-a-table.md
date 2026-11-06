# ADR 0042: The order state machine as a table

- **Status:** Accepted
- **Date:** 2026-11-06
- **Story:** C-2

## Context

Order status lives only in area 2. C-1 left a list of steps with no transitions, and a first sketch of the sales flow's states in the area 2 guide. C-2 needs every transition guarded, audited and tested, without a route having to know the rules. Spectra's briefing has not settled when an SPR is raised, who approves, or what a payment exception allows.

## Decision

1. **A plain table, not a library.** `TRANSITIONS` in `workflows/domain/order-state-machine.ts` lists each event, the statuses it is legal from, where it leads and who may make it. A guard that a table cannot express (the payment gate, an approved SPR on a shortfall, holds, cancelling) sits in `refusalOf` beside it. XState stays an option left open by ADR 0020: the table is short, and it is easy to test and to explain.
2. **The machine is pure.** It takes a state and returns the next state with the event that records it. `OrderWorkflowService` does the rest, so status, its `WorkflowEvent` row and its audit event commit in one transaction.
3. **The sketch's `PiSent` is dropped.** Sending the PI goes straight to `AwaitingPayment`, because nothing happens between the two.
4. **A rejected SPR returns to `StockChecked`,** with a required reason. On a shortfall the PI stays blocked until a corrected SPR is raised and approved.
5. **A held order remembers where it was.** Each hold has its own key (`check:<rule>` for a check, because area 3 reports by rule), and the order stays `OnHold` until every one has cleared. Only the system raises or clears a hold, because area 3 and area 4 report them.
6. **The facts live beside the status.** The new nullable `WorkflowInstance.facts` holds what the machine reads besides the status: the prepayment due, the stock answer, the holds and where to resume. A seeded sample has none and a `sample-` label instead, so the machine refuses to run it and `statusOf` answers null for it. Since C-3 the seed puts the orders with a submitted SPR on the machine as `AwaitingSpr`. Facts that fail to parse on a real order are damage, and fail loudly instead of passing as a sample.
7. **Two moves cannot both win.** Each save is conditional on `WorkflowInstance.version`. The loser changes nothing, and is refused and audited.
8. **Area 4's policy is asked where it has an action.** An SPR decision goes through `decideSpr`, whose signature requires the amount and the requester, and calls `AuthorisationService.enforce` before the transaction opens. Its policy knows only approval actions today and refuses any other name, so every other move is checked by role in the table alone. SPR decisions name no role in the table, because limits, substitutes and passing up the chain reach beyond one role: the policy says who (amended 2026-11-06, C-3).

## Consequences

- **Good:** every rule is in one tested file, and an illegal move cannot reach the database. Status and its record cannot disagree, because they commit together.
- **Limit: other moves have no policy check yet.** Payment confirmation and release are checked by role in the table only, until area 4's policy has actions for them. This meets C-2 for SPR decisions and is partial for the rest. Area 4 owns the list of actions, so the gap is for Angelyn to close.
- **Limit: nothing is published yet.** Events are `WorkflowEvent` rows until P-15 brings the event bus and outbox.
- **Limit: area 3's two ports are implemented but not bound.** `WorkflowOrderStatusReader` and `WorkflowCheckReporter` wait for area 3 to bind them, because the tracker would lose the seeded samples until they run on the machine.
- **Limit: the routes still answer from the mock.** The payment route and the task commands keep using `MockWorkflowActions` until a story binds them to `OrderWorkflowService`. C-3 moved the SPR decisions (amended 2026-11-06).
- **Open rules:** `sprRequiredOnShortfall` is injected with a default (A-21), not yet stored anywhere a person can change it. The PI sequence (A-22) is still in the table. The Navision mapping in `navisionStatusOf` is an assumption (A-36).

## Amendment, 6 Nov 2026: who holds an SPR is worked out, not stored

**Decision.** Who holds an SPR is asked of area 4's `deciderFor` on every read, and shown through its own route, `GET /workflows/tasks/handed-to-me`.

**Why.** Absence has a start and an end, and setups change. A stored assignment would need a job to move it at each of those moments and could go stale, and the policy would still have the last word on who may decide. Asking the policy means the task never offers what the policy refuses outright. One gap remains: someone above their limit with nobody above them sees the task as theirs, and is told so plainly when they decide. It is a separate route because the inboxes are by role and Management has none, while this belongs to one person.

**Consequences.** Each inbox read does this work, which is fine for the demo and needs batching at real volumes. `WorkflowTask.assigneeUserId` stays unused until the real read model binds, and that story should keep this rule rather than copy the answer into the column.

## Amendment, 6 Nov 2026: the sweep runs in the API until the worker can take it

**Decision.** Reminders and escalations run as a repeating BullMQ job, consumed inside the API process, in area 2's own module.

**Why.** The worker consumes no queue until P-15, which has no branch yet, and C-4 should not wait for it or reach into area 1's process. A real queue still gives retries, and only one consumer runs each sweep. Sending is safe to repeat because each notice has a unique key.

**Consequences.** The API does a little background work. It does not start in the seed, which boots the same module with no HTTP server. When P-15 lands, `WorkflowSweepJob` should move to the worker. The sweep itself needs no change, but the worker has no module graph yet, and this class starts only where there is an HTTP server, so its start has to change.
