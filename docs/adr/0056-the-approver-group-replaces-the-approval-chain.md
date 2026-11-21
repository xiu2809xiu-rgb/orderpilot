# ADR 0056: The approver group replaces the approval chain

- **Status:** Accepted. Rules on decisions 6, 8 and 10 of [ADR 0041](0041-the-authorisation-policy-with-approval-limits.md), which [ADR 0049](0049-the-spr-process-the-client-described.md) left open. The `APPROVER_GROUP` switch below is temporary: [#280](https://github.com/xiu2809xiu-rgb/orderpilot/issues/280) removes it.
- **Date:** 2026-11-15
- **Story:** [#252](https://github.com/xiu2809xiu-rgb/orderpilot/issues/252) (area 4), with area 2's #251

## Context

On 5 Nov Spectra described its SPR approval: a coordinator, a Support user, routes each SPR to three management approvers, any one of whom decides, and hands it back. Nobody stands in for anyone, and no limits were mentioned (ADR 0049). F-3 built the policy for the first reading: the `approval-route` rule sends a request along a chain, from the requester's approver to a substitute while they are away, then to the absent approver's own approver, and limits always apply (ADR 0041, decisions 6, 8 and 10).

Area 2's SPR flow (#251) is built on that chain today, and 21 of area 2's tests drive it through area 4's real policy. Switching the rule outright would break them before #251 lands, and area 4 does not edit area 2's files.

## Decision

1. **The approver group decides** (ADR 0041, decision 6). Any one enabled user with the `APPROVER` role, except the person who raised the request, may decide it. One role with three users is the group: there is no group record. An approver who is away stays in the group, because absence moves nothing now.
2. **`approversFor({ requester, action, amount })`** returns `{ approvers, reason }` for area 2 to route with. Each approver is `{ userId, displayName }` only, never an email, sorted by name. `reason` is set only when the list is empty. While limits are on, the list holds only the approvers whose own limit covers the amount. The route rule reads the group without that filter, so a refusal for the amount still names the limit rule.
3. **Limits are switchable, with none set:** `APPROVAL_LIMITS=off|on`, off by default, counts while the group decides. Decision 8, a substitute's own limit, has nothing to decide under the group, and stays only for the old chain until #280.
4. **Management is left out** of the group and of `approversFor`. While limits are off it decides no SPR. Who decides above every approver's limit, once Spectra sets limits, stays open.
5. **The seed is unchanged** (decision 10). Its sample chain and limits feed the old chain while the group is off, and sleep once it is on with limits off.
6. **The coordinator** holds a new permission, `spr.route`, with `spr.read` so it can open an SPR. `spr.route` is a policy action, so area 2 asks the policy before it routes. A segregation-of-duties pair keeps whoever routed an SPR from deciding it, even through a role that holds `approvals.decide`. **Assumption:** there is no coordinator role in OrderPilot, so Support routes. Spectra is asked which team Janet is in and who may route SPRs (Q-50).
7. **A second decision on the same SPR** is area 2's 409, audited on area 2's side, not area 4's.
8. **A temporary switch, `APPROVER_GROUP=off|on`, off by default.** While it is off, main behaves exactly as before #252: the old chain, its substitutes, its limits and `deciderFor` work unchanged, and every one of area 2's tests passes untouched. While it is on, points 1 to 4 apply. `deciderFor` is marked deprecated in words: a JSDoc tag would fail lint at area 2's three call sites.

**The plan:** #251 routes with `approversFor`, turns `APPROVER_GROUP` on and updates area 2's tests. Then #280 removes the switch, the old chain, `deciderFor`, `SUBSTITUTE_LIMITS`, substitutes and away dates, with a migration.

## Consequences

- Main changes nothing until #251 turns the switch on, so the Week 5 demo still shows today's chain.
- The route rule has two paths until #280. A test proves that with the switch off the old chain, its substitutes and its limits still decide, and the group's own tests run with it on.
- Area 2 can build #251 against `approversFor` now.
- `.env.example` gains `APPROVER_GROUP` and `APPROVAL_LIMITS`.

## Alternatives considered

- **Switching the rule outright.** Rejected: it breaks 21 of area 2's tests before #251.
- **Area 2 updating its tests in this change, or landing it together with #251.** Rejected for now: it would couple the two pull requests, or make this one wait.
- **A group record that the role points to.** Rejected: the role is the group, and three users with it are enough.
- **Keeping Management as the escalation.** Rejected: Spectra described no escalation by absence, and with no limits there is nothing above an approver.
