# ADR 0024: The governance base

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** F-1

## Context

Area 4 (Angelyn) owns the real policy: limits, segregation of duties, the bank-detail control and the masking rules. F-1 is the head start. It has to give the other areas something to call and the owner something to build on, without writing any rule that is the owner's to decide. P-10 already put the guards in place, with `PermissionPolicy` as the seam and the `RolePermission` table as the default matrix ([ADR 0012](0012-sessions-and-rbac.md)).

## Decision

1. **The matrix is the real `RolePermission` table.** The screen reads and writes it through `GET /governance/matrix`, `PUT /governance/matrix/:role/permissions/:permission` and `POST /governance/matrix/copy`. Reading needs `roles.read` and changing needs `roles.manage`, both checked by P-10's guard. Each change is audited in the same transaction (`governance.permission.granted`, `governance.permission.revoked`, `governance.role.copied`). The seed only adds missing pairs, so a pair the owner revokes comes back on the next seed: a later story decides whether the seed should stop doing that.
2. **The system admin never approves, posts or pays.** `NEVER_FOR_SYSTEM_ADMIN` in `packages/shared` lists `approvals.decide`, `payments.confirm` and `payments.post`. The default matrix does not grant them, and the server refuses to grant them (a locked cell on the screen, a 409 from the route, and a copy that would break one is refused too). `roles.manage` is locked on for the same role so the matrix can always be edited again. No role holds the three new permissions by default: who approves and who pays is for the owner to settle in the matrix. The policy also refuses them for the system admin at check time, so a row put in the table by another route changes nothing.
3. **A data scope per role** (`all`, `brands`, `own`) is stored in `RoleDataScope` (`governance.prisma`, its own migration) and shown on the matrix. The base stores and shows it. Nothing filters a list by it yet: enforcing it (a Product Manager sees only their brands' orders, if Spectra confirms brand ownership, Q-17) is the owner's.
4. **Users are disabled, never deleted.** The screen uses P-10's users routes and has no delete.
5. **Masking is done on the server.** `mask()` takes the rules, the role, the field and the value, and returns a `MaskedField`. For a role the rule does not list the value is `null`, so it cannot be read in the page or the network tab. The web app's `MaskedValue` shows the reason. One neutral sample rule ships (a customer note on synthetic customers). The bank-detail and price rules are the owner's.
6. **What data may go to which AI provider** is one function, `decideAiDestination`, behind `POST /governance/ai-destinations/check`. The default is synthetic data only, for every provider and every classification, and real data goes nowhere. P-17's gateway calls it before it sends anything.
7. **A refusal that reaches a caller is the standard error envelope** (`FORBIDDEN`, a generic message, the trace id). The rule that decided goes to the audit trail, never to the caller, so probing teaches nothing. `PolicyDecision` and `PolicyRequest` in `packages/shared` are the shape the owner's policy returns and reads. The screen draws a refusal with `RefusalPanel`.
8. **Contracts only:** classification levels, approval limits and substitutes in the shape of Navision's Approval User Setup, and the payment type (prepayment among them) for payment confirmation. No table or rule reads them yet. F-3 gives the limits a table.
9. **No new package.** The tabs and switch are written out in `components/ui` in the shadcn shape over `radix-ui`, which is already installed. CASL and PostHog stay options ([ADR 0020](0020-options-left-to-the-owners.md)).

## Consequences

- Angelyn can replace `MatrixPermissionPolicy` by providing another class under the `PermissionPolicy` token and read `PolicyRequest` without touching a controller.
- A role that loses `roles.read` cannot open the screen, and the API refuses it too, with an audited refusal.
- The sample permissions for approvals and payments are a starting point. If the owner prefers no sample, removing them from `DEFAULT_ROLE_PERMISSIONS` is one edit.
- The ADR number 0024 is the next free one on `main` at the time of writing. If another story merged first and took it, renumber this file.
