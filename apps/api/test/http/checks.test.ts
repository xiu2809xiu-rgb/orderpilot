import {
  ROLES,
  exceptionQueueSchema,
  kpiResponseSchema,
  orderTimelineResponseSchema,
  trackerListSchema,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("area 3 routes (mock data)", () => {
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

  it("pages the tracker on the server and stamps meta.mock", async () => {
    const res = await call(
      t,
      as("MANAGEMENT"),
      "get",
      `${API}/tracker/orders?page=2&pageSize=3`,
    );
    expect(res.status).toBe(200);
    const body = trackerListSchema.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.meta).toMatchObject({ page: 2, pageSize: 3, mock: true });
  });

  it("refuses a page size over the limit with the error envelope", async () => {
    const res = await call(
      t,
      as("MANAGEMENT"),
      "get",
      `${API}/tracker/orders?pageSize=500`,
    );
    expect(res.status).toBe(400);
  });

  it("returns one order's timeline, and 404 for an unknown order", async () => {
    const list = trackerListSchema.parse(
      (await call(t, as("MANAGEMENT"), "get", `${API}/tracker/orders`)).body,
    );
    const orderNo = list.data[0]?.orderNo;
    expect(orderNo).toBeTruthy();
    const res = await call(
      t,
      as("MANAGEMENT"),
      "get",
      `${API}/tracker/orders/${String(orderNo)}`,
    );
    expect(res.status).toBe(200);
    expect(orderTimelineResponseSchema.parse(res.body).meta.mock).toBe(true);
    const missing = await call(
      t,
      as("MANAGEMENT"),
      "get",
      `${API}/tracker/orders/SO-NOPE`,
    );
    expect(missing.status).toBe(404);
  });

  it("lists the exceptions and the five KPIs", async () => {
    const queue = await call(t, as("SUPPORT"), "get", `${API}/exceptions`);
    expect(queue.status).toBe(200);
    expect(exceptionQueueSchema.parse(queue.body).meta.mock).toBe(true);
    const kpis = await call(t, as("MANAGEMENT"), "get", `${API}/insights/kpis`);
    expect(kpis.status).toBe(200);
    const parsed = kpiResponseSchema.parse(kpis.body);
    expect(parsed.data.measures).toHaveLength(5);
    expect(parsed.data.labEstimate).toBe(true);
  });

  it("follows the default matrix: each route needs its own permission", async () => {
    const cases = [
      ["APPROVER", `${API}/tracker/orders`, 200],
      ["APPROVER", `${API}/exceptions`, 403],
      ["SUPPORT", `${API}/insights/kpis`, 403],
      ["PRODUCT_MANAGER", `${API}/insights/kpis`, 200],
      ["PRODUCT_MANAGER", `${API}/exceptions`, 403],
    ] as const;
    for (const [role, path, status] of cases) {
      const res = await call(t, as(role), "get", path);
      expect(res.status, `${role} ${path}`).toBe(status);
    }
  });

  it("answers 401 with no session", async () => {
    for (const path of [
      "/tracker/orders",
      "/tracker/orders/SO-1",
      "/exceptions",
      "/insights/kpis",
    ]) {
      expect((await call(t, null, "get", `${API}${path}`)).status, path).toBe(
        401,
      );
    }
  });
});
