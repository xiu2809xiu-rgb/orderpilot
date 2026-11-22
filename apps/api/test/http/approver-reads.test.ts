import { syntheticDataset } from "@orderpilot/synthetic-data";
import {
  ROLES,
  aiUsageReportSchema,
  clickstreamSummarySchema,
  exceptionQueueSchema,
  kpiResponseSchema,
  observabilityReportSchema,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskListResponseSchema } from "../../src/modules/workflows/workflows.schemas.js";
import {
  API,
  auditCount,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const PACK = syntheticDataset().tasks.find(
  (task) => task.kind === "PACK_ORDER" && task.assigneeRole === "WAREHOUSE",
);

/**
 * ADR 0058 step 4: the management approver takes the four reads Management
 * has today, so retiring Management at step 6 removes no power from anyone who
 * stays. Each route below was refused to the approver before this step.
 */
describe("the management approver's reads", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });
  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };
  const get = (role: Role, path: string) =>
    call(t, as(role), "get", `${API}${path}`);

  it("reads the exceptions queue (exceptions.read)", async () => {
    const res = await get("APPROVER", "/exceptions");
    expect(res.status).toBe(200);
    expect(exceptionQueueSchema.parse(res.body).data.length).toBeGreaterThan(0);
  });

  it("reads the insights (insights.read)", async () => {
    const res = await get("APPROVER", "/insights/kpis");
    expect(res.status).toBe(200);
    expect(
      kpiResponseSchema.parse(res.body).data.measures.length,
    ).toBeGreaterThan(0);
  });

  it("reads another role's task inbox, and only that role's tasks (workflows.inboxes.any)", async () => {
    for (const inbox of ["WAREHOUSE", "FINANCE"] as const) {
      const res = await get("APPROVER", `/workflows/inboxes/${inbox}/tasks`);
      expect(res.status, inbox).toBe(200);
      const tasks = taskListResponseSchema.parse(res.body).data;
      expect(tasks.length, inbox).toBeGreaterThan(0);
      expect(tasks.every((task) => task.assigneeRole === inbox)).toBe(true);
    }
  });

  it("reads AI usage, service health and the clickstream (aiUsage.read)", async () => {
    const usage = await get("APPROVER", "/monitoring/ai-usage");
    expect(usage.status).toBe(200);
    aiUsageReportSchema.parse(usage.body);
    const health = await get("APPROVER", "/monitoring/observability");
    expect(health.status).toBe(200);
    expect(observabilityReportSchema.parse(health.body).meta.mock).toBe(true);
    const clicks = await get("APPROVER", "/monitoring/clickstream");
    expect(clicks.status).toBe(200);
    expect(clickstreamSummarySchema.parse(clicks.body).meta.mock).toBe(true);
  });

  it("is the approver's grant: roles that never held each read are still refused", async () => {
    const refused = [
      ["PRODUCT_MANAGER", "/exceptions"],
      ["SUPPORT", "/insights/kpis"],
      ["PRODUCT_MANAGER", "/monitoring/ai-usage"],
      ["WAREHOUSE", "/workflows/inboxes/FINANCE/tasks"],
    ] as const;
    for (const [role, path] of refused) {
      expect((await get(role, path)).status, `${role} ${path}`).toBe(403);
    }
  });

  it("keeps the administrator out of the business-read routes, as before", async () => {
    for (const path of [
      "/exceptions",
      "/insights/kpis",
      "/workflows/inboxes/WAREHOUSE/tasks",
    ]) {
      expect((await get("SYSTEM_ADMIN", path)).status, path).toBe(403);
    }
  });

  // Reading every inbox is not owning one: the guard compares the task's role
  // with the caller's own role and never looks at workflows.inboxes.any.
  it("cannot complete or undo another role's task, though it may read every inbox, and audits each refusal", async () => {
    if (!PACK) throw new Error("No packing task in the dataset");
    const before = await auditCount(t, "workflows.task.refused");
    const done = await call(
      t,
      as("APPROVER"),
      "post",
      `${API}/workflows/tasks/${PACK.id}/complete`,
      { csrf: true },
    );
    expect(done.status).toBe(403);
    const undone = await call(
      t,
      as("APPROVER"),
      "post",
      `${API}/workflows/tasks/${PACK.id}/undo`,
      { csrf: true },
    );
    expect(undone.status).toBe(403);
    expect(await auditCount(t, "workflows.task.refused")).toBe(before + 2);
  });
});
