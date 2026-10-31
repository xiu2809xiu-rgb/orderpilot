import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Redis } from "ioredis";
import pg from "pg";
import { AppConfig } from "../../src/config/app-config.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import { assertSafeToReset, testInfrastructureEnv } from "./infrastructure.js";

const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** The API's configuration as the tests see it. */
export function testConfig(): AppConfig {
  return AppConfig.fromEnv({
    APP_ENV: "local",
    NODE_ENV: "test",
    ...testInfrastructureEnv(),
  });
}

/**
 * Empties every table of the test database. The audit table refuses TRUNCATE
 * on purpose, so its triggers are switched off for this one statement, in a
 * transaction, by the table's owner. Production code can never do this: it
 * needs the owner's rights and lives only in the test harness.
 */
export async function resetDatabase(): Promise<void> {
  assertSafeToReset();
  const client = new pg.Client({
    connectionString: testConfig().database.url,
  });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    if (rows.length === 0) return;
    const tables = rows.map((row) => quote(row.tablename));
    await client.query("BEGIN");
    try {
      await client.query('ALTER TABLE "AuditEvent" DISABLE TRIGGER USER');
      await client.query(
        `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`,
      );
      await client.query('ALTER TABLE "AuditEvent" ENABLE TRIGGER USER');
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

/** Flushes the test Redis database number only, never the others. */
export async function resetRedis(): Promise<void> {
  assertSafeToReset();
  const redis = new Redis(testConfig().redis.url);
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

/** Deletes every object in the test bucket, if it exists. */
export async function resetStorage(): Promise<void> {
  assertSafeToReset();
  const { storage } = testConfig();
  const s3 = new S3Client({
    region: storage.region,
    ...(storage.endpoint === null ? {} : { endpoint: storage.endpoint }),
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    },
  });
  try {
    let token: string | undefined;
    do {
      let page;
      try {
        page = await s3.send(
          new ListObjectsV2Command({
            Bucket: storage.bucket,
            ContinuationToken: token,
          }),
        );
      } catch (error) {
        if ((error as { name?: string }).name === "NoSuchBucket") return;
        throw error;
      }
      const keys = (page.Contents ?? []).flatMap((o) =>
        o.Key === undefined ? [] : [{ Key: o.Key }],
      );
      if (keys.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: storage.bucket,
            Delete: { Objects: keys },
          }),
        );
      }
      token = page.NextContinuationToken;
    } while (token);
  } finally {
    s3.destroy();
  }
}

/**
 * A clean slate: the tables, Redis database and bucket are emptied, then the
 * seed runs again, so a test starts from the same baseline every time.
 */
export async function resetTestData(
  options: { seed?: boolean } = {},
): Promise<void> {
  await Promise.all([resetDatabase(), resetRedis(), resetStorage()]);
  if (options.seed ?? true) await runSeed(testConfig());
}
