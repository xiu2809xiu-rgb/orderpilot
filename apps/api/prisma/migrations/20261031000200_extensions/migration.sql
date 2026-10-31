-- Extensions the AI and search work will need (ADR 0017). `vector` stores
-- embeddings for similarity search; `pg_trgm` gives fuzzy text matching for
-- customer and part names. Both ship in the pgvector image the stack runs on.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
