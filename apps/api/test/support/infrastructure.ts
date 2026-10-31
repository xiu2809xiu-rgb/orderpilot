/**
 * Where the integration tests run: their own database, Redis database number
 * and bucket. Names come from variables, so parallel worktrees can share one
 * PostgreSQL by giving each its own TEST_POSTGRES_DB, TEST_REDIS_DB and
 * TEST_S3_BUCKET in the root .env. The vitest config loads that file.
 */

function need(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set. Copy .env.example to .env at the repository root, run docker compose up -d --wait, and try again.`,
    );
  }
  return value;
}

/** The part after the last slash, before any query: the database name in a URL. */
export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/** The password of every seeded account under test. Not a secret. */
export const TEST_DEMO_PASSWORD = "test-demo-password-1";

/** The environment the API runs on under test. */
export function testInfrastructureEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: need("TEST_DATABASE_URL"),
    REDIS_URL: need("TEST_REDIS_URL"),
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: need("S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: need("S3_SECRET_ACCESS_KEY"),
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    S3_BUCKET: need("TEST_S3_BUCKET"),
    S3_CREATE_BUCKET: "true",
    DEMO_PASSWORD: TEST_DEMO_PASSWORD,
  };
}

/**
 * The tests delete data, so they refuse anything that could be development
 * data: the test database must differ from the development one and say "test"
 * in its name, and the Redis database number must differ too.
 */
export function assertSafeToReset(): void {
  const testDb = databaseNameOf(need("TEST_DATABASE_URL"));
  const devDb = process.env.DATABASE_URL
    ? databaseNameOf(process.env.DATABASE_URL)
    : undefined;
  if (!/^[a-z0-9_]+$/.test(testDb) || !testDb.includes("test")) {
    throw new Error(
      `Refusing to reset database "${testDb}": a test database has "test" in its name and only letters, digits and underscores.`,
    );
  }
  if (testDb === devDb) {
    throw new Error(
      `TEST_DATABASE_URL and DATABASE_URL name the same database ("${testDb}"). Give the tests their own with TEST_POSTGRES_DB.`,
    );
  }
  const testRedis = new URL(need("TEST_REDIS_URL")).pathname;
  const devRedis = process.env.REDIS_URL
    ? new URL(process.env.REDIS_URL).pathname
    : undefined;
  if (testRedis === devRedis) {
    throw new Error(
      "TEST_REDIS_URL and REDIS_URL use the same Redis database number. Give the tests their own with TEST_REDIS_DB.",
    );
  }
}
