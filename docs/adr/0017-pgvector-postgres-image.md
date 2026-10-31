# ADR 0017: The pgvector PostgreSQL image and its extensions

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-9

## Context

Richie's addendum of 31 October adds two database features: similarity search over embeddings (the AI work in areas 1 and 3) and fuzzy text matching (customer and part names that arrive spelled three ways). Both are PostgreSQL extensions. The stack ran the plain `postgres` image, which has neither `vector` nor the tooling to add it.

## Decision

1. **PostgreSQL runs from `pgvector/pgvector:0.8.6-pg18-trixie`**, the pgvector project's image on PostgreSQL 18 and Debian 13. The tag is exact. It is set once, in `docker-compose.yml`; CI starts the same file (`docker compose up`), so the laptop and the CI runner cannot drift apart.
2. **A migration enables the extensions.** `20261031000200_extensions` runs `CREATE EXTENSION IF NOT EXISTS vector` and `pg_trgm`. `pg_trgm` is part of PostgreSQL's contrib set in this image. An integration test (`apps/api/test/database/extensions.test.ts`) reads `pg_extension` and runs one query with each.
3. **The health check uses TCP.** `pg_isready -h 127.0.0.1`: without a host it can pass while the image's first-run script runs a temporary server on a Unix socket, before the real server is up.
4. **Version choice.** 0.8.7 appeared on 31 October, inside the project's 7-day rule for new releases, so 0.8.6 is pinned. Bumping is one line in the compose file and one in the test.

## Consequences

- The image is Debian-based, where the old one was Alpine. A local volume made by the Alpine image cannot be read by it (different file owner). A teammate with an older `orderpilot_postgres-data` volume removes that one volume and starts again: `docker compose down`, `docker volume rm orderpilot_postgres-data`, `docker compose up -d --wait`. The seed rebuilds the data.
- Production PostgreSQL (managed) must offer `vector` and `pg_trgm`. AWS RDS and Aurora do.
- No table uses a vector column yet. The first story that does adds the column and an index in its own migration.

## Alternatives considered

- **Install pgvector into the plain image at build time.** More to maintain than a published image, for no gain.
- **A separate vector store.** One more service to run and secure for a feature that fits in one table.
