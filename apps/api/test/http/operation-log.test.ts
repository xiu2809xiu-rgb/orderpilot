import { syntheticDataset } from "@orderpilot/synthetic-data";
import {
  DEFAULT_ROLE_PERMISSIONS,
  errorEnvelopeSchema,
  OPERATION_LOG_READERS,
  operationLogEntrySchema,
  ROLES,
  type OperationLogEntry,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const LOG = `${API}/operation-log`;
const data = syntheticDataset();
const PACK = data.tasks.find(
  (task) => task.kind === "PACK_ORDER" && task.assigneeRole === "WAREHOUSE",
);

interface Page {
  data: OperationLogEntry[];
  meta: { page: number; pageSize: number; total: number };
}

describe("a record's operation log over HTTP", () => {
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
  const read = (role: Role | null, path: string) =>
    call(t, role ? as(role) : null, "get", `${LOG}/${path}`);
  /** A user the admin can disable and enable without locking anyone out. */
  const warehouseId = () => as("WAREHOUSE").session.user.id;

  it("refuses a caller who is not signed in, and audits nothing for it", async () => {
    const before = (await auditEvents(t)).length;
    const res = await read(null, `User/${warehouseId()}`);
    expect(res.status).toBe(401);
    errorEnvelopeSchema.parse(res.body);
    expect((await auditEvents(t)).length).toBe(before);
  });

  it("shows anyone who may read a user who did what and when, and never a value or an IP", async () => {
    const admin = as("SYSTEM_ADMIN");
    const id = warehouseId();
    for (const verb of ["disable", "enable"]) {
      const res = await call(t, admin, "post", `${API}/users/${id}/${verb}`, {
        csrf: true,
      });
      expect(res.status).toBe(200);
    }
    const res = await read("SYSTEM_ADMIN", `User/${id}`);
    // Disabling ended the warehouse's sessions: sign in again for the tests after.
    sessions.set("WAREHOUSE", await demoSignIn(t, "WAREHOUSE"));
    expect(res.status).toBe(200);
    const page = res.body as Page;
    for (const entry of page.data) {
      expect(Object.keys(entry).sort()).toEqual(
        Object.keys(operationLogEntrySchema.shape).sort(),
      );
    }
    const [enabled, disabled] = page.data;
    expect(enabled?.summary).toBe(
      `${admin.session.user.displayName} enabled ${as("WAREHOUSE").session.user.displayName}`,
    );
    expect(enabled).toMatchObject({
      actorKind: "user",
      actorName: admin.session.user.displayName,
      actorRole: "SYSTEM_ADMIN",
    });
    expect(disabled?.summary).toContain("disabled");
    // The events hold the IP address and the changes; the log never does.
    const stored = (await auditEvents(t)).filter(
      (event) => event.entityType === "User" && event.entityId === id,
    );
    const ips = stored.flatMap((event) => (event.ip ? [event.ip] : []));
    expect(ips.length).toBeGreaterThan(0);
    for (const ip of ips) expect(res.text).not.toContain(ip);
    expect(res.text).not.toMatch(/sessionsRevoked|"changes"|"hash"|traceId/);
  });

  it("pages the log newest first, with a total", async () => {
    const id = warehouseId();
    const first = await read("SYSTEM_ADMIN", `User/${id}?pageSize=1`);
    const body = first.body as Page;
    expect(body.data).toHaveLength(1);
    expect(body.meta.pageSize).toBe(1);
    expect(body.meta.total).toBeGreaterThan(1);
    const second = (await read("SYSTEM_ADMIN", `User/${id}?pageSize=1&page=2`))
      .body as Page;
    const [newer] = body.data;
    const [older] = second.data;
    expect(Date.parse(newer?.occurredAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(older?.occurredAt ?? ""),
    );
  });

  it("refuses a role that may not read the record, and audits the refusal", async () => {
    const id = warehouseId();
    const res = await call(t, as("SUPPORT"), "get", `${LOG}/User/${id}`).set(
      "X-Request-Id",
      "op-log-refused-1",
    );
    expect(res.status).toBe(403);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe("FORBIDDEN");
    const refusal = (await auditEvents(t)).find(
      (event) => event.traceId === "op-log-refused-1",
    );
    expect(refusal).toMatchObject({
      action: "auth.permission.refused",
      actor: { kind: "user", role: "SUPPORT" },
      changes: { permission: "users.read" },
    });
    expect(refusal?.summary).toBe(
      `${as("SUPPORT").session.user.displayName} was refused viewing the users`,
    );
  });

  it("follows the role's permissions for every kind of record", async () => {
    for (const [kind, permission] of Object.entries(OPERATION_LOG_READERS)) {
      for (const role of ROLES) {
        const res = await read(role, `${kind}/any-record-1`);
        const allowed = DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
        expect(res.status, `${role} reading a ${kind} log`).toBe(
          allowed ? 200 : 403,
        );
      }
    }
  });

  it("keeps refusals out of a record's log", async () => {
    if (!PACK) throw new Error("no warehouse task in the dataset");
    // Support may not act on the warehouse's task: refused and audited on it.
    const refused = await call(
      t,
      as("SUPPORT"),
      "post",
      `${API}/workflows/tasks/${PACK.id}/complete`,
      { csrf: true },
    );
    expect(refused.status).toBe(403);
    const done = await call(
      t,
      as("WAREHOUSE"),
      "post",
      `${API}/workflows/tasks/${PACK.id}/complete`,
      { csrf: true },
    );
    expect(done.status).toBe(200);
    const res = await read("WAREHOUSE", `WorkflowTask/${PACK.id}`);
    const page = res.body as Page;
    expect(page.data.map((entry) => entry.actorRole)).toEqual(["WAREHOUSE"]);
    expect(page.data[0]?.summary).toContain("completed");
    expect(res.text).not.toContain("refused");
  });

  it("refuses a kind of record that has no log, and audits it", async () => {
    const res = await call(
      t,
      as("SYSTEM_ADMIN"),
      "get",
      `${LOG}/ApiRoute/anything`,
    ).set("X-Request-Id", "op-log-unknown-kind-1");
    expect(res.status).toBe(403);
    const refusal = (await auditEvents(t)).find(
      (event) => event.traceId === "op-log-unknown-kind-1",
    );
    expect(refusal?.action).toBe("auth.permission.refused");
    expect(refusal?.changes).toMatchObject({
      reason: "params-name-no-permission",
    });
  });

  it("refuses an id that is too long and a page size the API never serves", async () => {
    for (const path of [
      `User/${"x".repeat(201)}`,
      `User/${warehouseId()}?pageSize=500`,
      `User/${warehouseId()}?page=0`,
    ]) {
      const res = await read("SYSTEM_ADMIN", path);
      expect(res.status, path).toBe(400);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe(
        "VALIDATION_FAILED",
      );
    }
  });

  it("offers no route that writes to the log", async () => {
    const res = await call(
      t,
      as("SYSTEM_ADMIN"),
      "post",
      `${LOG}/User/${warehouseId()}`,
      { csrf: true, body: {} },
    );
    expect(res.status).toBe(404);
  });
});
