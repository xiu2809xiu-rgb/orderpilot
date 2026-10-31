import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { loadEnvFiles } from "../../src/config/load-env-files.js";
import {
  assertSafeToReset,
  databaseNameOf,
  testInfrastructureEnv,
} from "./infrastructure.js";
import { resetTestData } from "./reset.js";

const API_ROOT = resolve(import.meta.dirname, "../..");

/** What to try first, for each way PostgreSQL can fail to answer. */
function explain(error: unknown, url: URL): string {
  const message = error instanceof Error ? error.message : String(error);
  const where = `${url.hostname}:${url.port || "5432"}`;
  if (/role .* does not exist/i.test(message)) {
    return `PostgreSQL at ${where} answered, but does not know the role "${decodeURIComponent(url.username)}". Another PostgreSQL is probably running on that port. Stop it, or set POSTGRES_PORT in .env to a free port and run docker compose up -d --wait again.`;
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return `Nothing answers at ${where}. Is Docker running? Start the stack with: docker compose up -d --wait`;
  }
  return `Could not use PostgreSQL at ${where}: ${message}`;
}

/** Creates the test database on the same server if it is not there yet. */
async function ensureTestDatabase(testUrl: string): Promise<void> {
  const name = databaseNameOf(testUrl);
  const maintenance = new URL(testUrl);
  maintenance.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenance.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(explain(error, maintenance), { cause: error });
  }
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rowCount === 0) {
      // CREATE DATABASE takes no parameters. The name was checked against
      // [a-z0-9_]+ by assertSafeToReset, so quoting it is enough.
      await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }
}

function migrate(testUrl: string): void {
  const result = spawnSync(
    process.execPath,
    [
      resolve(API_ROOT, "node_modules/prisma/build/index.js"),
      "migrate",
      "deploy",
    ],
    {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: testUrl },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `prisma migrate deploy failed on the test database:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

/**
 * Runs once before the integration tests: makes sure the test database exists
 * and is migrated, empties it, Redis and the bucket, and seeds the baseline.
 * Fails with a plain message when the stack is not up.
 */
export default async function setup(): Promise<void> {
  loadEnvFiles();
  assertSafeToReset();
  const { DATABASE_URL: testUrl } = testInfrastructureEnv();
  if (testUrl === undefined) throw new Error("TEST_DATABASE_URL is not set");
  await ensureTestDatabase(testUrl);
  migrate(testUrl);
  await resetTestData({ seed: true });
}
