import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { Database } from "../../src/database/database.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

// The migration's own file, run as the deploy would run it. Reading the SQL (not
// copying it) means this test fails if the file stops doing its job.
const MIGRATION_SQL = readFileSync(
  new URL(
    "../../prisma/migrations/20261122090000_workflows_move_role_references_to_approver/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const ACTOR = "00000000-0000-4000-8000-0000000000a1";
const NAMED_PERSON = "00000000-0000-4000-8000-0000000000b2";

describe("the migration that moves stored role references to the approvers (#344)", () => {
  let t: TestContext;
  let db: Database;
  let client: pg.Client;

  async function auditRows(): Promise<unknown[]> {
    const { rows } = await client.query<Record<string, unknown>>(
      'SELECT * FROM "AuditEvent" ORDER BY sequence',
    );
    return rows;
  }

  async function clickRows(): Promise<unknown[]> {
    const { rows } = await client.query<Record<string, unknown>>(
      'SELECT * FROM "ClickstreamEvent" ORDER BY id',
    );
    return rows;
  }

  async function roleOf(
    table: string,
    column: string,
    key: string,
    id: string,
  ): Promise<string> {
    const { rows } = await client.query<{ role: string }>(
      `SELECT "${column}"::text AS role FROM "${table}" WHERE "${key}" = $1`,
      [id],
    );
    return rows[0]?.role ?? "missing";
  }

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    db = t.app.get(Database);
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await t.close();
    await resetTestData();
  });

  it("moves Management and auditor references to APPROVER, leaves the rest, and never touches an audit event or a click-stream row", async () => {
    const prisma = db.client;
    const now = new Date("2026-11-22T02:00:00.000Z");
    const sla = (
      taskKind: string,
      escalateToRole: "MANAGEMENT" | "AUDITOR" | "FINANCE" | "APPROVER",
    ) =>
      prisma.workflowTaskSla.create({
        data: {
          taskKind,
          dueAfterMinutes: 60,
          remindBeforeMinutes: 30,
          escalateAfterMinutes: 60,
          escalateToRole,
        },
      });
    // Spectra's 24-hour rule: the SPR approval keeps escalating to Management
    // until the role cut (step 6), so its row must survive this migration.
    await sla("APPROVE_SPR", "MANAGEMENT");
    await sla("CONFIRM_PAYMENT", "MANAGEMENT");
    await sla("SEND_PI", "AUDITOR");
    await sla("PACK_ORDER", "FINANCE");
    await sla("RAISE_SPR", "APPROVER");

    const notice = (
      recipientRole: "MANAGEMENT" | "AUDITOR" | "SUPPORT",
      message: string,
      recipientUserId?: string,
      taskId?: string,
    ) =>
      prisma.workflowNotification.create({
        data: {
          kind: "ESCALATION",
          recipientRole,
          recipientUserId,
          taskId,
          message,
          scheduledFor: now,
        },
      });
    const managementNotice = await notice("MANAGEMENT", "to Management");
    const auditorNotice = await notice("AUDITOR", "to the auditor");
    const supportNotice = await notice("SUPPORT", "to Support");
    // What the sweep writes for a handover: a named person, still under the role
    // they hold. Only the role moves, the person must stay.
    const personNotice = await notice(
      "MANAGEMENT",
      "to a named person",
      NAMED_PERSON,
    );

    const definition = await prisma.workflowDefinition.create({
      data: { key: "sales-order", version: 1, name: "Sales order", config: {} },
    });
    const instance = await prisma.workflowInstance.create({
      data: {
        definitionId: definition.id,
        orderRef: "SO-0001",
        status: "sample-open",
      },
    });
    const task = (
      assigneeRole: "MANAGEMENT" | "SUPPORT" | "APPROVER",
      title: string,
      kind = "SEND_PI",
    ) =>
      prisma.workflowTask.create({
        data: {
          instanceId: instance.id,
          kind,
          title,
          assigneeRole,
          dueAt: now,
        },
      });
    const managementTask = await task("MANAGEMENT", "held by Management");
    const supportTask = await task("SUPPORT", "held by Support");
    const approvalTask = await task(
      "APPROVER",
      "an SPR approval",
      "APPROVE_SPR",
    );

    // The escalations of an SPR approval task were sent to Management by Spectra's
    // 24-hour rule and stay that way. The same notice for any other task moves.
    const sprManagementNotice = await notice(
      "MANAGEMENT",
      "an SPR approval, to Management",
      undefined,
      approvalTask.id,
    );
    const sprAuditorNotice = await notice(
      "AUDITOR",
      "an SPR approval, to the auditor",
      undefined,
      approvalTask.id,
    );
    const taskManagementNotice = await notice(
      "MANAGEMENT",
      "a Send PI task, to Management",
      undefined,
      managementTask.id,
    );

    const exception = (fixBy: "MANAGEMENT" | "AUDITOR" | "SUPPORT") =>
      prisma.checkException.create({
        data: {
          orderNo: "SO-0001",
          customerNo: "C-10010",
          ruleId: "quantity",
          summary: "Quantity differs",
          expected: "10",
          actual: "9",
          toleranceLabel: "exact",
          toleranceValue: "0",
          evidence: [],
          fixBy,
        },
      });
    const managementException = await exception("MANAGEMENT");
    const auditorException = await exception("AUDITOR");
    const supportException = await exception("SUPPORT");

    await prisma.clickstreamEvent.create({
      data: {
        role: "MANAGEMENT",
        route: "/tracker",
        name: "page_view",
        occurredAt: now,
      },
    });
    // An event that says Management acted must keep saying so: its hash covers it.
    await t.app.get(AuditService).record({
      actor: { kind: "user", userId: ACTOR, role: "MANAGEMENT" },
      action: "test.role-reference",
      entityType: "Thing",
      entityId: "1",
      summary: "Management acted",
      traceId: "trace-role-reference",
    });

    const auditBefore = await auditRows();
    const clicksBefore = await clickRows();
    expect(auditBefore).toHaveLength(1);
    expect(clicksBefore).toHaveLength(1);

    await client.query(MIGRATION_SQL);

    const moved = [
      await roleOf(
        "WorkflowTaskSla",
        "escalateToRole",
        "taskKind",
        "CONFIRM_PAYMENT",
      ),
      await roleOf("WorkflowTaskSla", "escalateToRole", "taskKind", "SEND_PI"),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        managementNotice.id,
      ),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        auditorNotice.id,
      ),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        taskManagementNotice.id,
      ),
      await roleOf("WorkflowTask", "assigneeRole", "id", managementTask.id),
      await roleOf("CheckException", "fixBy", "id", managementException.id),
      await roleOf("CheckException", "fixBy", "id", auditorException.id),
    ];
    expect(moved).toEqual(Array(8).fill("APPROVER"));

    const { rows: personRows } = await client.query<{
      role: string;
      person: string | null;
    }>(
      'SELECT "recipientRole"::text AS role, "recipientUserId"::text AS person FROM "WorkflowNotification" WHERE id = $1',
      [personNotice.id],
    );
    expect(personRows).toEqual([{ role: "APPROVER", person: NAMED_PERSON }]);

    const kept = [
      await roleOf(
        "WorkflowTaskSla",
        "escalateToRole",
        "taskKind",
        "APPROVE_SPR",
      ),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        sprManagementNotice.id,
      ),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        sprAuditorNotice.id,
      ),
      await roleOf(
        "WorkflowTaskSla",
        "escalateToRole",
        "taskKind",
        "PACK_ORDER",
      ),
      await roleOf(
        "WorkflowTaskSla",
        "escalateToRole",
        "taskKind",
        "RAISE_SPR",
      ),
      await roleOf(
        "WorkflowNotification",
        "recipientRole",
        "id",
        supportNotice.id,
      ),
      await roleOf("WorkflowTask", "assigneeRole", "id", supportTask.id),
      await roleOf("CheckException", "fixBy", "id", supportException.id),
    ];
    expect(kept).toEqual([
      "MANAGEMENT",
      "MANAGEMENT",
      "AUDITOR",
      "FINANCE",
      "APPROVER",
      "SUPPORT",
      "SUPPORT",
      "SUPPORT",
    ]);

    // Row for row, the audit trail and the click stream are what they were. The
    // audit equality cannot fail on its own: the append-only trigger would refuse
    // an UPDATE of an AuditEvent first, so it is a second guard, not the only one.
    // The click-stream equality has no trigger behind it, so it is the real guard.
    expect(await auditRows()).toEqual(auditBefore);
    expect(await clickRows()).toEqual(clicksBefore);
    await expect(t.app.get(AuditService).verify()).resolves.toMatchObject({
      ok: true,
    });

    // Safe to run twice: a moved row no longer matches.
    await client.query(MIGRATION_SQL);
    expect(await auditRows()).toEqual(auditBefore);
    expect(
      await roleOf(
        "WorkflowTaskSla",
        "escalateToRole",
        "taskKind",
        "APPROVE_SPR",
      ),
    ).toBe("MANAGEMENT");
  });

  it("is safe on an empty database", async () => {
    await resetTestData({ seed: false });
    await expect(client.query(MIGRATION_SQL)).resolves.toBeDefined();
    const { rows } = await client.query<{ n: string }>(
      'SELECT count(*) AS n FROM "WorkflowTaskSla"',
    );
    expect(rows[0]?.n).toBe("0");
  });
});
