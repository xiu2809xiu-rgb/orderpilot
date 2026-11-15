# ADR 0041: The authorisation policy with approval limits

- **Status:** Accepted. Decisions 6, 8 and 10 are ruled on by [ADR 0055](0055-the-approver-group-replaces-the-approval-chain.md): the approver group decides once `APPROVER_GROUP` is on, and #280 removes the chain.
- **Date:** 2026-11-03
- **Story:** F-3

## Context

F-1 left area 4 the contracts (`PolicyRequest`, `PolicyDecision` and `ApprovalUserSetup` in `packages/shared/src/governance`) and the seam: the permissions guard asks whatever class sits behind `PermissionPolicy` ([ADR 0012](0012-sessions-and-rbac.md), point 7; [ADR 0024](0024-governance-base.md)). F-3 is the first real policy: who may do what, up to which amount, decided on the server. Approval limits follow Navision's Approval User Setup ([domain notes](../research/domain-notes.md)), and Spectra has not yet confirmed its approvers, limits or delegation (Q-6, Q-14), so all of it is configuration.

## Decision

1. **One policy, as a chain of rules.** `AuthorisationPolicy` (`apps/api/src/modules/governance/domain/`) runs its rules in order, and the first refusal wins with the rule's name and a reason. Each rule is one class with no HTTP and no database. Two chains share the rules (`domain/policies.ts`):
   - `ROUTE_POLICY` (system admin, permission) is what the guard runs, through `GovernancePermissionPolicy` behind the `PermissionPolicy` token.
   - `ACTION_POLICY` adds who may decide and the limit. An area runs it by calling `AuthorisationService.enforce(PolicyRequest, { ip, traceId })` before it acts. A route check knows only the permission; the amount and the requester exist only where the area asks.
2. **A refusal looks the way F-1 shows one.** `enforce` throws the standard 403 `FORBIDDEN` with the generic message, and writes `governance.policy.refused` with the action, the rule, the reason, the amount and the requester in `changes`. Amounts stay out of the summary, because masking may hide them. If the audit write fails, the caller is refused anyway and the failure is logged, as for the guard ([ADR 0012](0012-sessions-and-rbac.md), point 8).
3. **`enforce` refuses to run inside an open transaction.** The audit writer joins an open transaction, so a refusal thrown inside one would roll back its own audit event. The area asks first, then opens its transaction.
4. **The table.** `ApprovalUserSetup` in `governance.prisma` holds Navision's fields plus `awayFrom` and `awayUntil`. Navision does not record an absence, so the absence stays in area 4's own model, and the shared contract keeps Navision's fields one to one. Limits are `Decimal(18, 2)`, in whole cents. User ids are plain columns, as in the other areas' tables. The migration adds three `CHECK`s that Prisma cannot express: nobody is their own substitute, an absence starts before it ends, and no limit is below zero.
5. **The actions** (`domain/policy-actions.ts`): `spr.approve` and `purchase-order.approve` use the purchase limit. `sales-order.approve` uses the sales limit as a placeholder until Spectra says what a sales approval is ([A-19](../assumptions.md)). An action the policy does not know is refused (rule `action`).
6. **Who may decide** (rule `approval-route`, the open rule behind Q-6 and A-24):
   - the requester's Approver ID decides while present;
   - while they are away (`awayFrom` ≤ now < `awayUntil`, or from `awayFrom` with no end) or disabled, their substitute decides;
   - when the substitute is not set, is the approver themselves, has no setup, is disabled or is away too, the request escalates to the absent approver's own Approver ID, which the seed points at Management;
   - one level only: if that person cannot act either, nobody may decide, and the request is refused rather than sent to someone the setup never named.
7. **The limit** (rule `approval-limit`): the decider's own Sales or Purchase Amount Approval Limit, unless their Unlimited flag for that kind is set. An amount exactly at the limit is within it. A missing or negative amount, or a decider with no setup, is refused. Sending a request above the limit to someone whose limit covers it is C-3's routing.
8. **A substitute uses their own limit** (`SUBSTITUTE_LIMITS = "own"` in `domain/approval-limit-rule.ts`). That was decided on 3 Nov 2026 and is still being confirmed with Richie. The shared contract's comment describes the approver's limits. Flipping the one setting to `"approver"` changes nothing else, and a unit test covers both settings.
9. **Every change to a setup is audited** by `ApprovalSetupService.save`, as `governance.approval-setup.changed`. The event holds the before and after of the fields that changed, in the same transaction as the write. Saving what is already there writes nothing.
10. **The seed** (`approval-setup-seed.ts`) writes the sample chain once and never overwrites a row:
    - the Product Manager's requests go to the approver;
    - the approver has 20,000.00 for sales and 5,000.00 for purchases, and escalates to Management;
    - Management is unlimited.

    There is no substitute in the seed: the demo has one approver, and the Product Manager raises the SPRs.

## Alternatives considered

- **One `decide` function with every rule inline.** Rejected: each rule could no longer be tested and explained alone, and F-4 and F-5 would edit the same function.
- **The absence in the shared `approvalUserSetupSchema`.** Rejected: it would break the one-to-one mapping to Navision.
- **A production route that answers "would this be allowed?" so the tests can call it.** Rejected: it lets a caller probe the rules. The tests use a stand-in route that only the test app registers.
- **Following the Approver ID chain more than one level.** Rejected for now: deny by default. Following it further is a change to `deciderFor` only.

## Consequences

- **In other areas, not in this pull request:**
  - Richie: put `GovernancePermissionPolicy` behind `PermissionPolicy` in `auth.module.ts`, one line. Until then the guard uses `MatrixPermissionPolicy`, which applies the same two rules, and the tests swap the class in through `createTestApp`.
  - Richie: run `seedApprovalSetups` from `seeders.ts`, one line.
  - Richie: decide whether Management holds `approvals.decide` in `DEFAULT_ROLE_PERMISSIONS`, and update the role's description in `CLAUDE.md`. Until then an escalated request reaches Management and the guard refuses them. The tests grant the permission through the matrix route to prove the escalation.
  - Richie: update the comment in `approval.ts` if "own limit" is confirmed.
  - **Update, 8 Nov 2026:** Richie's four items are done. #205 put the policy behind the token and ran the seeder. #215 gave Management `approvals.decide` in the default matrix, with its description in `CLAUDE.md`, and the contract's comment in `approval.ts` now describes the substitute's own limit, as Richie asked.
  - Azri (C-3): call `enforce` from the SPR approval route before its transaction, and route tasks with `AuthorisationService.deciderFor`.
- **Data scope** (the story's second criterion) is not in this pull request. It waits for Q-17.
- **E2E #3 through `POST /workflows/sprs/:no/approve`** stays `it.todo` until C-3 calls `enforce`.
- **The routes** to read and change a setup (`roles.read` and `roles.manage`) come in a follow-up pull request, which P-66's form needs.
- **A known limit:** two people saving the same setup at the same instant may both record the same "before", because `save` takes no row lock. Setups change rarely and by one administrator, so this is accepted for now.
