import { defineConfig } from "prisma/config";
import { loadEnvFiles } from "./src/config/load-env-files.js";

// Prisma 7 no longer reads .env itself. Load the same files the API reads, with
// the same rules: the shell wins, and values may refer to each other.
loadEnvFiles();

// `prisma generate` needs no connection, so a fresh clone can install before it
// has a .env. Every command that connects needs the URL.
const generating = ["generate", "format", "validate"].some((command) =>
  process.argv.includes(command),
);
const url = process.env.DATABASE_URL;
if (!url && !generating) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repository root, then run docker compose up -d --wait.",
  );
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/database/seed/seed.ts",
  },
  datasource: { url: url ?? "postgresql://not-set@127.0.0.1:5432/not-set" },
});
