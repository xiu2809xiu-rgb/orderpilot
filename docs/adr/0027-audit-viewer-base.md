# ADR 0027: The audit viewer base

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** F-2

## Context

P-9 wrote the audit trail: an append-only, hash-chained `AuditEvent` table, a writer, and `AuditService.verify` ([ADR 0010](0010-prisma-with-postgresql.md)). Nothing reads it for a person yet. Area 4 (Angelyn) owns the auditor's view: filter the trail, check the chain, and see what changed. F-2 is the head start. It has to give the auditor a working viewer and the other areas a way to show an operation log under their records, without writing the parts that are the owner's (export, retention, anchoring, dashboards).

## Decision

1. **The viewer is read-only, and says so in the code.** `apps/api/src/modules/audit/` has three `GET` routes under `/audit` and no other verb: the event list, one event, and the chain check. All need `audit.read` (the system admin and the auditor hold it). There is no route that writes, edits or deletes an event, and a test calls `POST`, `PUT` and `DELETE` to show they answer 404. The append-only trigger stays the database's last line of defence.
2. **It reads only through P-9's code.** The viewer calls `AuditService.verify` for the chain and `AuditEventRepository` for events. The repository gained read methods, additively: `search` (filters and paging), `findRecordById`, `lastSequence`, `sequenceOf` and `sequenceBefore`. Prisma is still called only inside repositories.
3. **Filters are validated by one shared schema.** `auditEventQuerySchema` in `packages/shared/src/audit-viewer/` holds the page, the actor (kind or user id), the role, an action prefix, entity type and id, an inclusive time range, refusals only, and words in the summary. A bad value is a 400 with the standard envelope. The web app and the API read the same schema.
4. **A refusal is an action that ends in `.refused` or `.reuse-detected`.** That is what the auth layer writes today (`auth.permission.refused`, `auth.csrf.refused`, `auth.refresh.reuse-detected`). `isRefusalAction` is in `packages/shared`, so a new refusal action only has to follow the naming rule.
5. **Masking applies to an event's `changes`, on the server.** Each top-level key of `changes` is a field named `<entityType>.<key>`; a rule named `*.<key>` covers a key on every entity type. The viewer calls F-1's `mask()` for each value (and for both sides of a `{ from, to }` pair). A masked entry carries its classification and reason and no value, so a value the caller may not see is never in the response body. Masking is by the caller's role, so two readers of one event can see different things.
6. **The summary is not masked.** A summary is a sentence the writer composes ("Angelyn disabled Azri"). The writer's contract (P-9) is that it holds no value a masking rule would hide; sensitive values belong in `changes`. If a story breaks that rule, it must move the value into `changes`.
7. **One sample rule ships.** `*.reason` (why a request was refused) is visible to the auditor and hidden from the system admin, with the reason `policy`. It exists so the mechanism shows on real events. It is marked `sample: true`: which fields are hidden from whom, and why, is the owner's decision.
8. **The chain check reports sequences.** The response says `verifiedThrough` (the last sequence that fits) or `brokenAtSequence` (the first that does not) with the problem. "Verified through" is the newest sequence that existed when the check began, so an event written during the walk is not claimed. The check reads the whole trail, so it is one request at a time per click; scheduling it is the owner's.
9. **The operation log reads the same list.** An operation log under a record is the list filtered by `entityType` and `entityId`, fed to P-12's `OperationLog` by one component, `EntityOperationLog`, in `apps/web/src/features/audit/`. Its rows use the event's summary as "what changed". Area 2 and area 3 add it to their detail pages themselves.
10. **No new table, no new package.** The viewer needs no model: it reads `AuditEvent`. Actor names come from one new read method on the user repository (`namesByIds`).

## Left to the owner

Export, retention, anchoring the latest hash outside the database, scheduled verification, and the audit dashboards. The to-do tests name the export and retention cases.

## Consequences

- An auditor can answer "who did what, when, from where" and "has this trail been touched" without asking an engineer.
- Because masking is per role, a screenshot or a saved URL from one role is not what another role sees.
- The chain check cost grows with the trail. That is fine for the prototype and the reason scheduling is a later story.
- The ADR number 0027 was reserved for F-2 in the build plan.
