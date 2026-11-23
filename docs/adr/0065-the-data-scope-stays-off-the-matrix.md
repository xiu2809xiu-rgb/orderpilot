# ADR 0065: The data scope stays off the matrix until a list reads it

- **Status:** Accepted. Angelyn decided on 23 Nov 2026. Amends decision 3 of [ADR 0024](0024-governance-base.md), which is Richie's: the data scope is still stored, and no longer shown.
- **Date:** 2026-11-23
- **Story:** [#268](https://github.com/xiu2809xiu-rgb/orderpilot/issues/268)

## Context

ADR 0024, decision 3, stores a data scope per role (`all`, `brands`, `own`) in `RoleDataScope`, shows it on the matrix, and leaves enforcing it to area 4. Nothing reads it yet: no list endpoint (orders, items, SPRs, tasks) filters by it, and the matrix's own hint said so. In user testing on 12 Nov, Richie found that choosing a scope saved, showed a toast and changed nothing a person could see, which reads as broken. Copy a role also copied the scope, a second control changing the same unread setting.

Enforcing the scope needs two things that do not exist yet: a record of which brands a user owns (the synthetic data only names a product manager per brand, and Q-17 is answered only in part, A-28), and a filter in the list endpoints of areas 1, 2 and 3.

## Decision

1. **The matrix shows no data scope.** The selector, its hint, its toast and its Undo are gone.
2. **Copy a role copies the permissions only.** The target's data scope stays as it was, and a copy's audit row no longer records a scope change.
3. **The stored value stays.** `RoleDataScope`, its defaults, the scope in `GET /governance/matrix` and `PUT /governance/matrix/:role/data-scope` are unchanged, so enforcing the scope later needs no migration. Nothing on the screen calls the `PUT`.
4. **Enforcing the scope is a story of its own,** with the owners of the lists it would filter and Spectra's answer to Q-17. That story brings the selector back, together with the filter that gives it a meaning.

## Alternatives considered

- **Enforce it now** (#268's second way out). It needs brand ownership and a filter in every area's lists, so it is wider than one fix, and it waits for Q-17.
- **Keep the selector and reword its hint.** It would still be a control that changes nothing a person can see.
- **Remove the stored value and the endpoint.** It changes the shared contract and the generated client for no gain, and the story that enforces the scope would add them back.
- **Let Copy keep carrying the scope.** Copy would still change a setting nobody can see, now out of sight.

## Consequences

- A system admin can no longer set the scope from the screen. The `PUT` still sets it, audited, for the story that enforces it.
- A copy's audit row lists the permissions granted and revoked, and no scope.
- The copy endpoint's summary changes, so `openapi.json` and the generated client change by one line each.
- The `it.todo` "applies the data scope, so a Product Manager sees only their brands" stays open for that story.
