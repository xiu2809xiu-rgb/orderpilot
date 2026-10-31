-- A refresh keeps the session's demo flag (P-10).
ALTER TABLE "RefreshToken" ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false;
