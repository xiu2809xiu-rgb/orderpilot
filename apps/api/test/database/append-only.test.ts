import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

describe("the AuditEvent table is append-only", () => {
  let t: TestContext;
  let client: pg.Client;
  let id: string;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    const event = await t.app.get(AuditService).record({
      actor: { kind: "system", name: "trigger-test" },
      action: "test.append-only",
      entityType: "Thing",
      entityId: "1",
      summary: "Written once",
      traceId: "trace-trigger-test",
    });
    id = event.id;
    client = new pg.Client({ connectionString: testConfig().database.url });
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
    await t.close();
    await resetTestData();
  });

  it("refuses UPDATE", async () => {
    await expect(
      client.query(
        `UPDATE "AuditEvent" SET summary = 'Changed' WHERE id = $1`,
        [id],
      ),
    ).rejects.toThrow(/append-only: UPDATE/);
  });

  it("refuses DELETE", async () => {
    await expect(
      client.query(`DELETE FROM "AuditEvent" WHERE id = $1`, [id]),
    ).rejects.toThrow(/append-only: DELETE/);
  });

  it("refuses TRUNCATE, with CASCADE too", async () => {
    await expect(client.query('TRUNCATE TABLE "AuditEvent"')).rejects.toThrow(
      /append-only: TRUNCATE/,
    );
    await expect(
      client.query('TRUNCATE TABLE "AuditEvent" CASCADE'),
    ).rejects.toThrow(/append-only: TRUNCATE/);
  });

  it("refuses a change even when it would touch no row's content", async () => {
    await expect(
      client.query(`UPDATE "AuditEvent" SET summary = summary`),
    ).rejects.toThrow(/append-only/);
  });

  it("still allows INSERT, and the event is untouched after every refusal", async () => {
    const { rows } = await client.query<{ summary: string }>(
      `SELECT summary FROM "AuditEvent" WHERE id = $1`,
      [id],
    );
    expect(rows).toEqual([{ summary: "Written once" }]);
  });
});
