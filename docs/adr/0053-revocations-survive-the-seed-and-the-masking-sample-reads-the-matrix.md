# ADR 0053: Revocations survive the seed, and the masking sample reads the matrix

- **Status:** Accepted. Amends [ADR 0012](0012-sessions-and-rbac.md) point 12 and [ADR 0024](0024-governance-base.md) point 1.
- **Date:** 2026-11-13
- **Story:** F-8 ([#96](https://github.com/xiu2809xiu-rgb/orderpilot/issues/96))

## Context

The seed fills the role-permission matrix with the default pairs that are missing, and nothing else, so it is safe to run again. That had one side effect: a pair the system admin revoked on the matrix came back on the next seed, which runs on every deploy and before every test run. ADR 0024 left the decision to a later story.

The masking sample on the Masking tab had its rule in code: five roles named in `SAMPLE_RULES`. Showing or hiding the note for a role meant a code change, while the matrix screen exists to make exactly that kind of decision without one.

## Decision

1. **A revocation is recorded.** `RevokedRolePermission` (`governance.prisma`) holds each pair revoked on the matrix, whether by a switch or by copying a role, written in the same transaction as the change and its audit event. Granting the pair again removes the row. Only the matrix routes write it.
2. **The seed adds the defaults minus those rows.** `seedRolePermissions` (`modules/governance/role-permission-seed.ts`) takes `pairsToSeed(DEFAULT_ROLE_PERMISSIONS, revoked)`, a pure function with its own unit tests, and the shared seed step calls it as it calls `seedApprovalSetups`. A default pair that is missing with no row is still added, so a permission a later story brings reaches an existing database. The seed's line says how many default pairs stay out.
3. **The limit.** A revocation made before this story has no row, so it comes back once on the next seed. Revoking it again on the matrix records it, and from then on it stays out. We accepted this rather than guessing at history: the audit trail could have supplied it, but reading the trail would make the seed depend on audit rows and on their shape.
4. **A table, not a flag or the trail.** A revoked pair has no `RolePermission` row to flag. Reading `governance.permission.revoked` events from the audit trail was the other option, and was rejected for the reason in point 3.
5. **Who sees the sample note is a row of the matrix.** `masking.customerNote` is a permission like any other, held by default by the five roles the hard-coded rule named. `PolicyService` reads the live matrix and builds the note's rule from it (`sampleNoteRule`), so the Masking tab follows the matrix without a code change, and says so with a link to the row. `SAMPLE_RULES` keeps the default roles for the callers in areas 1 and 3 that mask with it; only the sample reads the matrix.

## Consequences

- A system admin's revocation now holds through deploys and seeds, and the seed log says what it left out.
- Each developer's database has revocations from before this story, if any, that return once. The matrix shows them; revoking again settles it.
- `masking.customerNote` reaches every list of permissions: the matrix, the refusal wording, the generated client and the label the matrix shows. The refusal wording and the permission list are shared files, changed in their own commit.
- The matrix's search box (F-8 part 1) has no "Masking" group yet, so the new row lists under "Other" until a one-line follow-up names it.
