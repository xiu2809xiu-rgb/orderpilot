# ADR 0024: The area 2 base, ports and mocks

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** C-1

## Context

The area 2 base has to give Azri screens, routes and models without writing his core logic: the state machine, the SPR rules, the payment gate and the SLA logic. It also has to show every screen state with believable data before any of that exists, and keep Navision's Approval User Setup and area 4's policy at arm's length.

## Decision

1. **Routes read through a port.** `WorkflowReadModel` is an abstract class with four reads (tasks, an order's flow, an SPR, reminders). The base binds it to `MockWorkflowReadModel`, which builds typed data from `@orderpilot/synthetic-data`. A story swaps it for a Prisma-backed class under the same token. The mock answers carry `meta.mock: true`, and the screens show the Mock badge from that field, so a real answer drops the badge without a screen change.
2. **Commands check and answer, nothing more.** Approve, reject and confirm payment validate the body, check the record, run behind the permission guard and answer `applied: false` with a message. This keeps the contract and the screens real while the state machine does not exist.
3. **Order status is written in one place.** `WorkflowInstance.status` is plain text. The demo seed writes the dataset's `sample-` labels; nothing else in the base writes it. The state machine will decide the values.
4. **Area 4's policy sits behind `ApprovalPolicy`.** Area 2 calls `approverFor` and reads rows in the shape of Navision's Approval User Setup (approver, sales and purchase limits, unlimited flags, substitute), so a later Navision link maps one to one. The mock holds invented limits. The limit check itself is not in the base.
5. **Who may open whose inbox is a permission.** "My tasks" is the caller's own inbox. Looking at another role's inbox is a separate route behind `workflows.inboxes.any`, answered by the PermissionPolicy and the role-permission matrix. No list of roles is kept in area 2.
6. **Configuration is a table.** Field settings and defaults for each document type are rows in `DocumentTypeConfig`, seeded from `DEFAULT_DOCUMENT_CONFIG`. The configuration route reads the table. Labels stay in code because they are names, not settings.
7. **Record numbers come from one atomic upsert.** `RecordCounter` holds one row per type and Singapore day. `INSERT ... ON CONFLICT DO UPDATE SET lastValue = lastValue + 1` (Prisma's upsert with an increment) gives each caller a distinct number without a lock.
8. **Commands use the generated functions inside `useMutation`.** The orval config generates every verb as a query hook, so the screens wrap the generated `workflowsApprove` and its siblings in TanStack's `useMutation`. They still go through the `ApiClient`.

## Consequences

- Azri's stories replace two classes (the read model and, with area 4, the approval policy) and fill in the commands. The screens, routes and contracts stay.
- A mock answer can drift from what the real data will be. The mock data is checked against the shared contract schemas in a test, and the routes' responses are parsed against the same schemas in the integration test.
- The mock's dates are fixed around the dataset's "today" (2 Nov 2026), so overdue flags show on screen; they are not a service-level rule.

## Alternatives considered

- **Routes backed by the database from the start.** More realistic, but it needs instances and tasks that only the state machine should create, so the base would either invent that logic or ship empty screens.
- **A role list inside area 2 for the inbox scope.** Simpler, but it is an access rule, and area 4 owns those.
- **Advisory locks for record numbers.** Works, but an upsert is one statement and needs no lock.
