import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { AuditService } from "../../src/audit/audit.service.js";
import { Database } from "../../src/database/database.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const actor = { kind: "system", name: "audit-test" } as const;

function input(
  action: string,
  extra: { changes?: Record<string, unknown> } = {},
) {
  return {
    actor,
    action,
    entityType: "Thing",
    entityId: "1",
    summary: `Test ${action}`,
    traceId: "trace-audit-test",
    ...extra,
  };
}

describe("the audit writer", () => {
  let t: TestContext;
  let audit: AuditService;
  let events: AuditEventRepository;
  let database: Database;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    audit = t.app.get(AuditService);
    events = t.app.get(AuditEventRepository);
    database = t.app.get(Database);
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("chains each event's hash to the one before it, starting from null", async () => {
    const first = await audit.record(input("test.chain.first"));
    const second = await audit.record(input("test.chain.second"));
    expect(first.prevHash).toBeNull();
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.prevHash).toBe(first.hash);
    expect(second.hash).not.toBe(first.hash);
    await expect(audit.verify()).resolves.toMatchObject({
      ok: true,
      checked: 2,
    });
  });

  it("stores what changed and reads it back exactly, whatever the key order", async () => {
    const written = await audit.record(
      input("test.changes", { changes: { z: 1, a: { y: [1, 2], b: null } } }),
    );
    const read = await events.findById(written.id);
    expect(read).toEqual(written);
    await expect(audit.verify()).resolves.toMatchObject({ ok: true });
  });

  it("joins the caller's transaction: a commit keeps the event", async () => {
    await database.transaction(async () => {
      await audit.record(input("test.commit"));
    });
    await expect(events.existsByAction("test.commit")).resolves.toBe(true);
  });

  it("joins the caller's transaction: a rollback leaves no event, and no gap in the chain", async () => {
    await expect(
      database.transaction(async () => {
        await audit.record(input("test.rollback"));
        throw new Error("business rule said no");
      }),
    ).rejects.toThrow("business rule said no");
    await expect(events.existsByAction("test.rollback")).resolves.toBe(false);
    await expect(audit.verify()).resolves.toMatchObject({ ok: true });
  });

  it("keeps one unbroken chain when many transactions write at once", async () => {
    const before = (await audit.verify()).checked;
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        audit.record(input(`test.parallel.${String(i)}`)),
      ),
    );
    const report = await audit.verify();
    expect(report).toMatchObject({ ok: true, checked: before + 25 });
    const hashes: string[] = [];
    const previous = new Set<string | null>();
    for await (const event of events.readChain(10)) {
      hashes.push(event.hash);
      // A fork would show as two events with the same predecessor.
      expect(previous.has(event.prevHash)).toBe(false);
      previous.add(event.prevHash);
    }
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("lists newest first, a page at a time", async () => {
    const page = await events.list({ page: 1, pageSize: 3 });
    expect(page.items).toHaveLength(3);
    expect(page.meta.total).toBeGreaterThan(25);
    const [newest, next] = page.items;
    expect(newest?.prevHash).toBe(next?.hash);
  });

  it("shows tampering: an event changed behind the trigger's back breaks verification", async () => {
    const victim = await audit.record(input("test.tamper"));
    await audit.record(input("test.after-tamper"));
    const client = new pg.Client({
      connectionString: testConfig().database.url,
    });
    await client.connect();
    try {
      // What an attacker with the table owner's rights would have to do first.
      await client.query("BEGIN");
      await client.query('ALTER TABLE "AuditEvent" DISABLE TRIGGER USER');
      await client.query(
        `UPDATE "AuditEvent" SET summary = 'Rewritten' WHERE id = $1`,
        [victim.id],
      );
      await client.query('ALTER TABLE "AuditEvent" ENABLE TRIGGER USER');
      await client.query("COMMIT");
    } finally {
      await client.end();
    }
    const report = await audit.verify();
    expect(report.ok).toBe(false);
    expect(report.brokenAt).toEqual({
      id: victim.id,
      problem: "hash-mismatch",
    });
  });
});
