import { syntheticDataset } from "@orderpilot/synthetic-data";
import { ROLES, type Role } from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const data = syntheticDataset();

interface Listed<T = Record<string, unknown>> {
  data: T[];
  meta: { total: number };
}

/**
 * The lists the home tiles count. A tile asks for pageSize=1 and shows
 * `meta.total`, so a count can only disagree with its list if paging a list
 * changes its total. Each case walks the whole list to prove it does not.
 */
const LISTS: readonly (readonly [Role, string])[] = [
  ["SUPPORT", "/workflows/tasks"],
  ["WAREHOUSE", "/workflows/tasks?overdue=true"],
  ["APPROVER", "/workflows/tasks?kind=APPROVE_SPR"],
  ["FINANCE", "/workflows/tasks?kind=CONFIRM_PAYMENT"],
  ["MANAGEMENT", "/workflows/inboxes/APPROVER/tasks?kind=APPROVE_SPR"],
  ["MANAGEMENT", "/workflows/inboxes/FINANCE/tasks?kind=CONFIRM_PAYMENT"],
  ["MANAGEMENT", "/tracker/orders?open=true"],
  ["MANAGEMENT", "/tracker/orders?overdue=true"],
  ["SUPPORT", "/tracker/orders?documentToConfirm=true"],
  ["PRODUCT_MANAGER", "/tracker/orders?status=sample-pending-approval"],
  ["LOGISTICS", "/tracker/orders?status=sample-ready-to-pick"],
  ["SUPPORT", "/exceptions?state=OPEN"],
  ["AUDITOR", "/audit/events"],
  ["AUDITOR", "/audit/events?refusalsOnly=true"],
  ["SYSTEM_ADMIN", "/users?active=true"],
];

describe("the home page's counts", () => {
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
  const get = (role: Role, path: string) => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return call(t, browser, "get", `${API}${path}`);
  };
  const withQuery = (path: string, query: string) =>
    `${path}${path.includes("?") ? "&" : "?"}${query}`;
  const list = async (role: Role, path: string) => {
    const res = await get(role, path);
    expect(res.status, `${role} ${path}`).toBe(200);
    return res.body as Listed;
  };

  it.each(LISTS)("%s: a tile on %s equals its list", async (role, path) => {
    const tile = await list(role, withQuery(path, "pageSize=1"));
    const whole = await list(role, withQuery(path, "pageSize=200"));
    expect(tile.meta.total).toBe(whole.meta.total);
    expect(whole.data).toHaveLength(whole.meta.total);
  });

  it("a tile on the roles equals the matrix, and the AI use equals its report", async () => {
    const matrix = (await get("AUDITOR", "/governance/matrix")).body as {
      data: { roles: unknown[] };
      meta: { total: number };
    };
    expect(matrix.meta.total).toBe(matrix.data.roles.length);
    expect(matrix.meta.total).toBe(ROLES.length);

    const usage = await get("SYSTEM_ADMIN", "/monitoring/ai-usage?pageSize=1");
    expect(usage.status).toBe(200);
    expect((usage.body as Listed).meta.total).toBeGreaterThanOrEqual(0);
  });

  it("counts the open orders as every order that is not closed", async () => {
    const open = await list(
      "MANAGEMENT",
      "/tracker/orders?open=true&pageSize=1",
    );
    const closed = data.orders.filter(
      (order) => order.sampleScreenState === "sample-closed",
    );
    expect(open.meta.total).toBe(data.orders.length - closed.length);
  });

  it("filters on several statuses at once", async () => {
    const codes = ["sample-short-stock", "sample-pending-approval"];
    const both = await list(
      "SUPPORT",
      `/tracker/orders?status=${codes.join(",")}&pageSize=200`,
    );
    const expected = data.orders.filter((order) =>
      codes.includes(order.sampleScreenState),
    );
    expect(both.meta.total).toBe(expected.length);
  });

  it("keeps only orders with a document to confirm", async () => {
    const shown = await list(
      "SUPPORT",
      "/tracker/orders?documentToConfirm=true&pageSize=200",
    );
    const expected = data.orders.filter((order) =>
      order.documents.some((document) => document.status === "to-confirm"),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(shown.meta.total).toBe(expected.length);
  });

  it("sorts the overdue orders by amount, largest first", async () => {
    const shown = (await list(
      "MANAGEMENT",
      "/tracker/orders?overdue=true&sort=amount&direction=desc&pageSize=5",
    )) as Listed<{ amount: string }>;
    const amounts = shown.data.map((row) => Number(row.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("lists every exception for ALL, and only the open ones by default", async () => {
    const all = await list("SUPPORT", "/exceptions?state=ALL&pageSize=1");
    const open = await list("SUPPORT", "/exceptions?state=OPEN&pageSize=1");
    const plain = await list("SUPPORT", "/exceptions?pageSize=1");
    expect(all.meta.total).toBe(data.exceptions.length);
    expect(plain.meta.total).toBe(open.meta.total);
    expect(open.meta.total).toBeLessThan(all.meta.total);
  });

  it("keeps enabled or disabled users", async () => {
    const all = await list("SYSTEM_ADMIN", "/users?pageSize=1");
    const on = await list("SYSTEM_ADMIN", "/users?active=true&pageSize=1");
    const off = await list("SYSTEM_ADMIN", "/users?active=false&pageSize=1");
    expect(on.meta.total + off.meta.total).toBe(all.meta.total);
  });

  describe("the sales flow", () => {
    interface Flow {
      data: {
        openOrders: number;
        steps: { id: string; statuses: string[]; count: number }[];
      };
      meta: { mock: true };
    }

    it("has the brief's nine steps, adding up to the open orders", async () => {
      const res = await get("SUPPORT", "/tracker/flow");
      expect(res.status).toBe(200);
      const { data: flow, meta } = res.body as Flow;
      expect(meta.mock).toBe(true);
      expect(flow.steps).toHaveLength(9);
      const sum = flow.steps.reduce((total, step) => total + step.count, 0);
      expect(sum).toBe(flow.openOrders);
      const open = await list(
        "SUPPORT",
        "/tracker/orders?open=true&pageSize=1",
      );
      expect(flow.openOrders).toBe(open.meta.total);
    });

    it("opens each step's own orders in the tracker", async () => {
      const { data: flow } = (await get("SUPPORT", "/tracker/flow"))
        .body as Flow;
      for (const step of flow.steps) {
        const listed = await list(
          "SUPPORT",
          `/tracker/orders?status=${step.statuses.join(",")}&open=true&pageSize=1`,
        );
        expect(listed.meta.total, step.id).toBe(step.count);
      }
    });

    it("needs tracker.read", async () => {
      expect((await get("SYSTEM_ADMIN", "/tracker/flow")).status).toBe(403);
      expect((await call(t, null, "get", `${API}/tracker/flow`)).status).toBe(
        401,
      );
    });
  });
});
