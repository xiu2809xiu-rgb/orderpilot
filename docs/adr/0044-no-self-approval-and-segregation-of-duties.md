# ADR 0044: No self-approval and segregation of duties

- **Status:** Accepted
- **Date:** 2026-11-06
- **Story:** F-4

## Context

F-3 built the authorisation policy as a chain of rules ([ADR 0041](0041-the-authorisation-policy-with-approval-limits.md)). F-4 adds the rules that depend on who the actor is to the record: whoever raised a request never decides it, nobody sets the terms of their own approvals, and some duties are always done by different people. The issue names three pairs of duties to keep apart, and asks that they be configuration.

## Decision

1. **Three new rules, in the same chain.** No separate mechanism. The order in `domain/policies.ts`, with the first refusal winning:

   | #   | Rule                    | Why it sits here                                                                      |
   | --- | ----------------------- | ------------------------------------------------------------------------------------- |
   | 1   | `system-admin`          | The platform's promise comes first                                                    |
   | 2   | `permission`            | Without the right, nothing else matters                                               |
   | 3   | `no-self-approval`      | Before the route and the limit, so no substitute, escalation or limit can outweigh it |
   | 4   | `own-setup`             | After `permission`, so holding `roles.manage` gets you this far and no further        |
   | 5   | `segregation-of-duties` | Who did an earlier duty on the record, before the chain is consulted                  |
   | 6   | `approval-route`        | Only for someone who may act at all                                                   |
   | 7   | `approval-limit`        | Only for the person the chain names                                                   |

2. **`no-self-approval`** compares user ids, never roles, so a change of role after raising a request changes nothing. It applies to any request that carries a requester.
3. **The route never hands a request back to its requester.** `deciderFor` passes over the requester wherever they appear on the chain (approver, substitute or escalation), as if they were away, and moves on. If that leaves nobody, the refusal says so: "nobody else on the chain can act, and the one who could raised the request". `enforce` still refuses a requester who acts anyway, through rule 3.
4. **`own-setup`** refuses `approval-setup.change` on one's own row. `ApprovalSetupService.save` asks the policy, before its transaction, whenever a person makes the change. A system actor, such as the seed, has no row of its own and does not ask. Naming yourself as someone else's substitute is not refused: `no-self-approval` already stops you deciding their requests that you raised.
5. **The duties kept apart are configuration** (`SEGREGATED_DUTIES` in `domain/segregation-of-duties.ts`):

   | Earlier duty                | Rules out, on the same record                                            |
   | --------------------------- | ------------------------------------------------------------------------ |
   | `spr.raise` (the requester) | `spr.approve`                                                            |
   | `vendor-payment.approve`    | `payment-hold.clear`                                                     |
   | `vendor-bank.change`        | `payment-hold.clear`, `vendor-payment.approve`, `vendor-payment.release` |

   The issue's "confirming a payment and clearing a payment hold" is read as the vendor payment, because a hold only ever stops a payment to a vendor. Confirming a customer's payment is its own action, `customer-payment.confirm`, and sits in no pair.

6. **New actions** (`domain/policy-actions.ts`); an action's limit is now optional:
   - `approval-setup.change` (`roles.manage`);
   - `customer-payment.confirm` and `payment-hold.clear` (`payments.confirm`);
   - `vendor-payment.approve` and `vendor-payment.release` (`payments.post`).
7. **Who did an earlier duty comes from the caller's stored records.** `AuthorisationService` takes `GovernanceRequest`, an area 4 extension of F-1's `PolicyRequest` with `earlierDuties`. The caller takes the requester and every person in `earlierDuties` from its own records (the SPR's raisedBy, the payment's approvedBy), never from a request body, which would let a caller name someone else and pass. The shared contract is unchanged.
8. **Every refusal is audited the way F-3 does it:** `governance.policy.refused`, with the rule, the reason, the requester and the earlier duties in `changes`, and the standard 403 `FORBIDDEN` to the caller.

## Alternatives considered

- **Reading the earlier duties from the audit trail.** Rejected: it would tie area 4 to the wording of other areas' events.
- **Adding `earlierDuties` to the shared `PolicyRequest` now.** Deferred: the shared file is Richie's, and only area 2 and area 4 need the field yet.
- **Leaving the requester on the chain and only refusing them.** Rejected: a request could then wait on the one person who may never decide it.

## Consequences

- **No caller supplies earlier duties yet.** The payment steps don't ask the policy, and nothing in OrderPilot changes a vendor's bank details: they come read-only from Navision (A-15). The rules and their tests are in place; F-5 and area 2's payment steps feed them.
- **E2E #3 through `POST /workflows/sprs/:no/approve` stays `it.todo`.** That route still records decisions in area 2's mock overlay, not through `decideSpr`, which does call `enforce`.
- **`payments.post` is held by no role by default,** so the vendor payment actions are refused by `permission` for everyone until the matrix grants it. The tests grant it through the matrix route.
