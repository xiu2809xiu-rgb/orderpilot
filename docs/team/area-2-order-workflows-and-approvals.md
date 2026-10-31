# Area 2: Order workflows and approvals

**Owner:** Azri. **Backup:** TBD until T-1. **Capability:** C, with parts of E. Paths and reviewers are in [module ownership](module-ownership.md#area-2-order-workflows-and-approvals-azri).

## Goal

Move every order through Spectra's steps without anyone chasing. Area 2 owns the state machine that holds each order's status, the tasks it gives each role, SPR approval within limits, the payment gate, reminders and escalations, and the documents and notifications each step produces.

### User stories

- As a **Product Manager**, I raise an SPR from a shortfall with one button, and see who holds it and when it was decided.
- As the **approver**, I approve or reject an SPR within my limit, with a comment, and anything above my limit escalates.
- As **Support**, my inbox shows only the tasks that wait on me, oldest and most overdue first.
- As the **warehouse**, a packing task appears only once Finance has confirmed the payment.
- As **Finance**, confirming a payment opens the gate for packing, and the order moves on by itself.
- As **Logistics**, a missing AWB/BL or import permit reminds me before it is late, and escalates if I miss it.
- As **Management**, I can see how long each step takes and where orders wait.

## Contracts

How area 2 meets the others ([How the areas connect](../../CLAUDE.md#how-the-areas-connect)). The event names below are proposals: P-7 drafts the order and event contract, and the team agrees it in Week 3, with every owner reviewing it.

| With   | Area 2 gives                                                                                               | Area 2 takes                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Area 1 | Requests for generated documents (PI, invoice, packing list) through the template engine                   | The order and its documents (`order.created`, `fields.confirmed`); stock levels; AI drafts of messages |
| Area 3 | Every status change (`order.status-changed`) and task event (`task.overdue`), for the tracker and the KPIs | Check results (`check.completed`, pass or fail). Area 2 decides what a failure blocks                  |
| Area 4 | Each approval, release and payment action, to be checked before it happens                                 | The policy's decision on each action; payment holds (`payment.held`, `payment.hold-cleared`)           |

- **Order status lives only here.** No other area stores or computes an order's status. The order's data belongs to area 1; area 3 only reads the status.
- **Every transition is checked by area 4's policy,** on the server, before it runs. A refusal leaves the order as it was.
- **Every transition is audited,** with who, when, from which state to which, and why.
- **Open rules are configuration:** the SPR trigger, the PI sequence, approvers and limits, and delegation ([assumptions](../assumptions.md) A-21 to A-24).
- **Approval limits and delegation** follow the shape of Navision's Approval User Setup (Approver ID, Sales and Purchase Amount Approval Limits, Unlimited flags, Substitute), shared with area 4 ([domain notes](../research/domain-notes.md)).

## Recommended design

- **State machine as data.** A transition table: from state, event, guard, to state, effects. The machine is a domain class with no HTTP or Prisma, so every transition can be unit-tested. Azri writes it himself (C-2).
- **Commands for actions.** Each action (approve, reject, confirm payment, release) is a command with its own validation, checked by the policy, then applied by the machine.
- **Events out, through the outbox** (planned: P-15). A transition and its events commit in the same transaction, so a retry never loses or doubles one. Idempotency keys make a repeated command harmless.
- **Strategies for timing.** Reminder and escalation schedules are a Strategy, configured per step, run by BullMQ jobs (planned: P-9, P-15). Deadlines are in Singapore time.
- **Numbers.** OrderPilot's own records take a type prefix, the date and a running number, such as `SPR-20261102-0001` (planned: P-7 and C-1), shown beside Navision's numbers.

A first sketch of the sales flow's states, for Azri to rework in C-2:

`Received` → `Confirmed` → `StockChecked` → (`AwaitingSpr` → `SprApproved`) → `PiSent` → `AwaitingPayment` → `Paid` → `Packing` → `Invoiced` → `Released` → `AwaitingShippingDocuments` → `Closed`, with `OnHold` (an exception or a payment hold) and `Cancelled` reachable from most states.

The PO-to-approval sequence:

```mermaid
sequenceDiagram
  actor PM as Product Manager
  participant W as Area 2: workflows
  participant P as Area 4: policy
  actor A as Approver
  PM->>W: Raise SPR (pre-filled from the shortfall)
  W->>P: May this user raise it?
  P-->>W: Allowed
  W->>W: SprRaised, task for the approver
  W-->>A: Task in the inbox
  A->>W: Approve, with a comment
  W->>P: Within the limit, and not the requester?
  P-->>W: Allowed
  W->>W: SprApproved, audited, events out
```

## What the base gives you

All planned. Each item lands with the story named, and C-1 fills this section in with what actually landed.

- **From C-1, the area 2 base:**
  - models for workflow definitions, instances, tasks, events and notifications;
  - routes that return typed mock data, in Swagger;
  - screens wired to them, covering every state: each role's task inbox, an order's steps and timeline, the SPR approval page (approve or reject, with a comment) and reminders;
  - `it.todo` tests naming the key cases: transitions, SPR limits, the payment gate, reminders and escalations, and retries with idempotency;
  - numbering for OrderPilot's own records, such as SPR drafts (with P-7);
  - a payment record with its type, prepayment among them, ready for the payment gate (with F-1);
  - configurable fields and default values for each document type, as configuration, not code;
  - the SPR pre-fill from a shortfall: the system suggests and a person approves (area 1 deepens it later).
- **From the platform:** the shared contracts, roles and permissions (P-7); the API shell (P-8); the database, queues and audit writer (P-9); sign-in and the permissions guard (P-10); the web shell (P-11) and common components (P-12); the event bus, outbox, worker and live updates (P-15); and synthetic orders in different states (P-9's seed).

## What's yours to build

**Starter stories,** ready to pull on the board (planned: P-2 seeds them):

- **C-2: the state machine,** with the sales flow's states and transitions. Written again by Azri as his first story, so that it stays his work.
- **C-3: SPR approval within limits,** with escalation above the limit.
- **C-4: reminders and escalations,** per step, from configuration.

**The deeper work,** for the A-level depth:

- the payment gate (Should 1), with area 4's policy and Finance's confirmation;
- the PI draft for Support (Should 2), on area 1's template engine;
- AWB/BL and import-permit follow-ups (Should 4);
- notifications with drafts that the AI writes and a person sends (Should 5, with area 1);
- delegation and substitutes while the approver is away;
- the purchase flow (phase 2): an SPR becomes a vendor PO draft, payment holds from area 4 block it, and a reminder fires when payment falls due;
- full test coverage: every legal transition, every illegal one refused, retries and duplicate commands, and timeouts that escalate. 100% of workflow tests pass.

## At the Week 7 interview

Be ready to explain, in your own code:

- why order status lives only in your state machine, and how other areas read it;
- how a transition is guarded, applied, audited and published, in one transaction;
- how idempotency keys stop a retried command from running twice;
- how SPR limits and escalations work, and where the limits come from;
- how reminders are scheduled, and what happens when the worker restarts;
- how your tests prove that illegal transitions are refused.

## Risks

| Risk                                                 | What to do                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| The state machine grows tangled as Should items land | Keep it as a table; add states only through the transition table, with tests |
| Spectra's rules differ from our assumptions          | Keep every open rule in configuration; never hard-code a limit or a sequence |
| A retry or a double click moves an order twice       | Idempotency keys and the outbox; test duplicate commands                     |
| Reminders flood people                               | One reminder per task per schedule step; escalate instead of repeating       |
| Status logic leaks into other areas                  | Review other areas' pull requests that touch status; publish events instead  |

## Module requirements

| Requirement           | How area 2 covers it                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| M1 Design thinking    | The future journey's steps and the approver's and Support's pains (HMW-3 to HMW-5)    |
| M2 GRS by design      | Approval limits, the payment gate and audited transitions, with area 4's policy       |
| M3 AI-assisted coding | Prompts kept as `area2-NNN-…`, and rows in the AI usage log                           |
| M4 Best practices     | A tested state machine, validation at boundaries, idempotency and 100% workflow tests |
| M5 Team Git workflow  | Stories on the board, one branch and pull request each, reviews within a day          |
| M6 Deploy and monitor | Approval turnaround and overdue steps, measured from workflow events                  |
