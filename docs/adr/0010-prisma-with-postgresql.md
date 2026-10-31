# ADR 0010: Prisma with PostgreSQL

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-9

## Context

Every area stores data: documents and orders, workflows and approvals, checks, and the audit trail. We need one relational database, one way to describe its tables that four people can edit without trampling each other, migrations that run the same on every laptop and in CI, and an audit trail that cannot be quietly rewritten. The team is TypeScript throughout, so types that come from the schema are worth having.

## Decision

1. **PostgreSQL 18, run by Docker Compose** (`docker-compose.yml`, project name `orderpilot`). The same file starts it on a laptop and in CI, so the versions cannot drift apart.
2. **Prisma 7 with the `pg` driver adapter.** The client is generated into `apps/api/src/generated/prisma` (ignored by Git, rebuilt by `pnpm install` and `pnpm db:generate`) as ESM, so `tsc` compiles it with the rest. The connection string lives in `apps/api/prisma.config.ts`, which reads the same root `.env` as the API.
3. **A multi-file schema in `apps/api/prisma/schema/`.** `base.prisma` holds the generator and the datasource; each area owns one file (`platform.prisma` now; `documents.prisma`, `workflows.prisma`, `checks.prisma` and the rest as their stories land, as [module ownership](../team/module-ownership.md) names them). Two people changing different areas touch different files. Migrations are one shared, linear folder; each belongs to the area whose schema it changes.
4. **Migrations are plain SQL files, reviewed in the pull request.** `prisma migrate dev` creates one after a schema edit; `pnpm db:migrate` (`migrate deploy`) applies the pending ones, in CI and everywhere else. Things Prisma cannot express, such as the audit trigger, are hand-written SQL migrations.
5. **Repositories are the only place Prisma is called.** Services and controllers never import it: a lint rule fails the build if they do. `Database` gives a repository the right client, and `Database.transaction(work)` runs a business change in one transaction, joined by every repository call and by the audit writer inside it. Tests of services use the in-memory repository and need no database.
6. **Raw SQL is tagged or absent.** `$queryRawUnsafe` and `$executeRawUnsafe` are banned by the shared lint preset, because they build SQL from strings. The tagged `$queryRaw` and `$executeRaw` escape their parameters.
7. **The audit trail is append-only, twice over.**
   - A trigger refuses `UPDATE`, `DELETE` and `TRUNCATE` on `AuditEvent`, for every role.
   - Each event stores the SHA-256 of its fields and of the event before it. The writer takes a Postgres advisory lock (`pg_advisory_xact_lock`) so concurrent transactions queue and each reads the true previous hash. The lock is held until the surrounding transaction ends, and the event is written inside the caller's transaction, so a rollback leaves no event and no gap. `AuditService.verify` walks the trail and reports the first event that does not fit.
8. **Users are disabled, never deleted** (`User.disabledAt`), so the audit trail and every record keep pointing at a real row. Refresh tokens carry a family, a token hash, an expiry, a `usedAt` and a `revokedAt`, which is what P-10's rotation and reuse detection need.
9. **Money and quantities are `Decimal`** in the schema (the rule is recorded now; no money column exists yet) and decimal strings on the wire.
10. **Tests run against a real database.** There is a separate test database, Redis database number and bucket, named by variables, so parallel worktrees can share one PostgreSQL. A Vitest global set-up creates, migrates, empties and seeds it. The data reset switches the audit triggers off for one statement, in a transaction, and only for a database whose name contains `test` and differs from the development one.

## Consequences

- A teammate edits their own `.prisma` file, runs `pnpm db:migrate:dev`, and commits the schema and the new migration together.
- `pnpm test` needs the stack up (`pnpm stack:up`). The unit tests alone run with `pnpm --filter @orderpilot/api test:unit`.
- The trigger stops accidents and careless code, not a database owner with a motive: the hash chain is what shows tampering made with those rights, and it only detects it. Anchoring the latest hash outside the database (a signed daily export) is a later hardening step.
- Verifying reads the whole trail. That is fine for a demo; a long-lived system would verify in segments or on a schedule.
- Advisory-lock chaining serialises audited transactions. Fine at this scale; a high write rate would need per-stream chains.
- Prisma 7.9.1 is pinned because pnpm's release-age and publish-evidence checks refuse the newer 7.10 releases for now. Move up when they pass.

## Alternatives considered

- **TypeORM or Drizzle.** Capable, but Prisma's generated types, multi-file schema and migration flow suit a team of four who are not all database specialists.
- **One schema file.** Simpler, and a merge-conflict magnet for four people.
- **Row-level security and per-role database users.** Stronger, and more set-up than a four-week build allows. Authorisation is enforced in the API (P-10).
