import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Redis } from "ioredis";
import pg from "pg";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { AuditService } from "../../src/audit/audit.service.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import { ObjectStorage } from "../../src/storage/object-storage.js";
import { assertSafeToReset } from "../support/infrastructure.js";
import {
  resetDatabase,
  resetRedis,
  resetStorage,
  resetTestData,
  testConfig,
} from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

describe("the test harness", () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestContext();
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("empties the audit table although a trigger refuses TRUNCATE, and leaves the trigger on", async () => {
    await t.app.get(AuditService).record({
      actor: { kind: "system", name: "harness" },
      action: "test.reset",
      entityType: "Thing",
      entityId: "1",
      summary: "Will be wiped",
      traceId: "trace-harness",
    });
    await resetDatabase();
    const events = t.app.get(AuditEventRepository);
    expect((await events.list({ page: 1, pageSize: 5 })).meta.total).toBe(0);

    const client = new pg.Client({
      connectionString: testConfig().database.url,
    });
    await client.connect();
    try {
      await expect(client.query('TRUNCATE TABLE "AuditEvent"')).rejects.toThrow(
        /append-only/,
      );
    } finally {
      await client.end();
    }
  });

  it("flushes only the test Redis database number, never the development one", async () => {
    const config = testConfig();
    const test = new Redis(config.redis.url);
    // A different number from the test one, on the same server. The test
    // number is configurable, so a fixed choice here could be that same one.
    const otherDb = config.redis.url.endsWith("/5") ? "/6" : "/5";
    const other = new Redis(config.redis.url.replace(/\/\d+$/, otherDb));
    try {
      await test.set("harness:sentinel", "1");
      await other.set("harness:sentinel", "1");
      await resetRedis();
      expect(await test.get("harness:sentinel")).toBeNull();
      expect(await other.get("harness:sentinel")).toBe("1");
    } finally {
      await other.del("harness:sentinel");
      test.disconnect();
      other.disconnect();
    }
  });

  it("empties the test bucket", async () => {
    const storage = t.app.get(ObjectStorage);
    await storage.put("harness/one.txt", "one", { contentType: "text/plain" });
    await resetStorage();
    await expect(storage.head("harness/one.txt")).resolves.toBeNull();
  });

  it("re-seeds to the same baseline, and seeding again changes nothing", async () => {
    await resetTestData();
    const events = t.app.get(AuditEventRepository);
    const count = async () =>
      (await events.list({ page: 1, pageSize: 50 })).meta.total;
    // The first link of the chain, then one event for each of the nine users.
    expect(await count()).toBe(10);
    const lines: string[] = [];
    await runSeed(testConfig(), (line) => lines.push(line));
    await runSeed(testConfig());
    expect(await count()).toBe(10);
    expect(lines.map((l) => l.split(":")[0])).toEqual([
      "seed storage",
      "seed audit",
      "seed role permissions",
      "seed users",
      "seed synthetic data",
      "seed workflows",
    ]);
    expect(lines.join("\n")).toContain(
      "Synthetic demo data: 5 customers, 3 vendors, 30 items, 10 orders",
    );
    expect(lines[1]).toContain("started already");
  });
});

describe("the reset guards", () => {
  it("refuse a database that is not clearly a test database", () => {
    vi.stubEnv(
      "TEST_DATABASE_URL",
      "postgresql://u:p@127.0.0.1:5432/orderpilot",
    );
    expect(() => {
      assertSafeToReset();
    }).toThrow(/has "test" in its name/);
    vi.unstubAllEnvs();
  });

  it("refuse when the test and development databases are the same", () => {
    vi.stubEnv(
      "TEST_DATABASE_URL",
      "postgresql://u:p@127.0.0.1:5432/shared_test",
    );
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@127.0.0.1:5432/shared_test");
    expect(() => {
      assertSafeToReset();
    }).toThrow(/same database/);
    vi.unstubAllEnvs();
  });

  it("refuse when the test and development Redis databases are the same number", () => {
    vi.stubEnv("TEST_REDIS_URL", "redis://127.0.0.1:6379/0");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379/0");
    expect(() => {
      assertSafeToReset();
    }).toThrow(/same Redis database/);
    vi.unstubAllEnvs();
  });

  it("allow the defaults from .env.example", () => {
    expect(() => {
      assertSafeToReset();
    }).not.toThrow();
  });
});
