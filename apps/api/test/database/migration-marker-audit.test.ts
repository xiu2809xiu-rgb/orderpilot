import pg from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { MigrationMarkerAuditor } from "../../src/audit/migration-marker.auditor.js";
import { Database } from "../../src/database/database.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const MIGRATION = "20261122090000_workflows_move_role_references_to_approver";

interface EventRow {
  actorKind: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes: Record<string, unknown> | null;
}

describe("the audit events of what a data migration changed (#344, ADR 0058 decision 8)", () => {
  let t: TestContext;
  let db: Database;
  let client: pg.Client;
  // The trail is append-only, so a test counts only the events after its own start.
  let startedAt = 0;

  /** What the data migration leaves for one SLA row it moved. */
  async function leaveMarker(taskKind: string, before: string): Promise<void> {
    await db.client.migrationMarker.create({
      data: {
        migration: MIGRATION,
        action: "workflows.sla.changed",
        entityType: "WorkflowTaskSla",
        entityId: taskKind,
        changes: {
          before: { escalateToRole: before },
          after: { escalateToRole: "APPROVER" },
        },
      },
    });
  }

  async function slaEvents(): Promise<EventRow[]> {
    const { rows } = await client.query<EventRow>(
      `SELECT "actorKind", "actorUserId", "actorLabel", "action", "entityType", "entityId", "summary", "changes"
       FROM "AuditEvent" WHERE "action" = 'workflows.sla.changed' AND "sequence" > $1 ORDER BY "entityId"`,
      [startedAt],
    );
    return rows;
  }

  async function eventCount(): Promise<number> {
    const { rows } = await client.query<{ n: string }>(
      'SELECT count(*) AS n FROM "AuditEvent"',
    );
    return Number(rows[0]?.n);
  }

  async function unstamped(): Promise<number> {
    return db.client.migrationMarker.count({ where: { auditedAt: null } });
  }

  beforeAll(async () => {
    await resetTestData();
    t = await createTestContext();
    db = t.app.get(Database);
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  beforeEach(async () => {
    const { rows } = await client.query<{ last: string }>(
      'SELECT coalesce(max("sequence"), 0) AS last FROM "AuditEvent"',
    );
    startedAt = Number(rows[0]?.last);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.client.migrationMarker.deleteMany();
  });
  afterAll(async () => {
    await client.end();
    await t.close();
    await resetTestData();
  });

  it("writes one event for each marker by the system, with before, after and the migration, and stamps it", async () => {
    await leaveMarker("CONFIRM_PAYMENT", "MANAGEMENT");
    await leaveMarker("SEND_PI", "AUDITOR");
    const eventsBefore = await eventCount();

    await expect(t.app.get(MigrationMarkerAuditor).record()).resolves.toBe(2);

    expect(await eventCount()).toBe(eventsBefore + 2);
    const events = await slaEvents();
    expect(events).toEqual([
      {
        actorKind: "system",
        actorUserId: null,
        actorLabel: "migration",
        action: "workflows.sla.changed",
        entityType: "WorkflowTaskSla",
        entityId: "CONFIRM_PAYMENT",
        summary: `Migration ${MIGRATION} changed WorkflowTaskSla CONFIRM_PAYMENT`,
        changes: {
          before: { escalateToRole: "MANAGEMENT" },
          after: { escalateToRole: "APPROVER" },
          migration: MIGRATION,
        },
      },
      {
        actorKind: "system",
        actorUserId: null,
        actorLabel: "migration",
        action: "workflows.sla.changed",
        entityType: "WorkflowTaskSla",
        entityId: "SEND_PI",
        summary: `Migration ${MIGRATION} changed WorkflowTaskSla SEND_PI`,
        changes: {
          before: { escalateToRole: "AUDITOR" },
          after: { escalateToRole: "APPROVER" },
          migration: MIGRATION,
        },
      },
    ]);
    // The audit page masks a key called reason, and nothing here is a refusal.
    for (const event of events) {
      expect(Object.keys(event.changes ?? {})).not.toContain("reason");
    }
    expect(await unstamped()).toBe(0);
    await expect(t.app.get(AuditService).verify()).resolves.toMatchObject({
      ok: true,
    });
  });

  it("writes nothing the second time, because every marker is stamped", async () => {
    await leaveMarker("CONFIRM_PAYMENT", "MANAGEMENT");
    const auditor = t.app.get(MigrationMarkerAuditor);
    await expect(auditor.record()).resolves.toBe(1);
    const eventsAfterFirst = await eventCount();

    await expect(auditor.record()).resolves.toBe(0);

    expect(await eventCount()).toBe(eventsAfterFirst);
    expect(await slaEvents()).toHaveLength(1);
  });

  it("writes nothing when there are no markers, as on a fresh database", async () => {
    const eventsBefore = await eventCount();
    await expect(t.app.get(MigrationMarkerAuditor).record()).resolves.toBe(0);
    expect(await eventCount()).toBe(eventsBefore);
    expect(await slaEvents()).toEqual([]);
  });

  it("leaves the marker unstamped when the event cannot be written, then writes it on the next run", async () => {
    await leaveMarker("CONFIRM_PAYMENT", "MANAGEMENT");
    const eventsBefore = await eventCount();
    vi.spyOn(t.app.get(AuditService), "record").mockRejectedValueOnce(
      new Error("the audit write failed"),
    );
    const auditor = t.app.get(MigrationMarkerAuditor);

    await expect(auditor.record()).rejects.toThrow("the audit write failed");
    expect(await unstamped()).toBe(1);
    expect(await eventCount()).toBe(eventsBefore);

    await expect(auditor.record()).resolves.toBe(1);
    expect(await unstamped()).toBe(0);
    expect(await slaEvents()).toHaveLength(1);
  });

  it("writes one event for a marker even when two seeds run at once", async () => {
    await leaveMarker("CONFIRM_PAYMENT", "MANAGEMENT");
    await leaveMarker("SEND_PI", "AUDITOR");
    const auditor = t.app.get(MigrationMarkerAuditor);

    const written = await Promise.all([auditor.record(), auditor.record()]);

    expect(written[0] + written[1]).toBe(2);
    expect(await slaEvents()).toHaveLength(2);
  });

  it("runs as the last step of the seed, once per marker and never again", async () => {
    await leaveMarker("CONFIRM_PAYMENT", "MANAGEMENT");
    await leaveMarker("SEND_PI", "AUDITOR");
    const lines: string[] = [];

    await runSeed(testConfig(), (line) => lines.push(line));

    expect(lines.at(-1)).toBe(
      "seed migration markers: 2 migration changes recorded in the audit trail",
    );
    expect(await slaEvents()).toHaveLength(2);
    const eventsAfterFirst = await eventCount();

    const again: string[] = [];
    await runSeed(testConfig(), (line) => again.push(line));
    expect(again.at(-1)).toBe(
      "seed migration markers: 0 migration changes recorded in the audit trail",
    );
    expect(await eventCount()).toBe(eventsAfterFirst);
  });
});
