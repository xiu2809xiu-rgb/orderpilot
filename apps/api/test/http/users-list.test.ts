import { ROLES, type Role } from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

interface Page {
  data: { displayName: string; email: string; role: Role }[];
  meta: { total: number };
}

describe("the users list: search and role filters", () => {
  let t: TestApp;
  let admin: Browser;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    admin = await demoSignIn(t, "SYSTEM_ADMIN");
  });
  afterAll(async () => {
    await t.close();
  });
  const list = async (query: string) => {
    const res = await call(t, admin, "get", `${API}/users${query}`);
    return { status: res.status, body: res.body as Page };
  };

  it("keeps one role", async () => {
    for (const role of ROLES) {
      const res = await list(`?role=${role}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((user) => user.role)).toEqual([role]);
    }
  });

  it("finds words in the name or the email, ignoring case", async () => {
    const name = admin.session.user.displayName;
    const byName = await list(
      `?search=${encodeURIComponent(name.toUpperCase())}`,
    );
    expect(byName.body.data.map((user) => user.displayName)).toEqual([name]);
    const local = admin.session.user.email.split("@")[0] ?? "";
    const byEmail = await list(`?search=${encodeURIComponent(local)}`);
    expect(byEmail.body.data.map((user) => user.email)).toContain(
      admin.session.user.email,
    );
    const none = await list("?search=no-such-person-anywhere");
    expect(none.body.meta.total).toBe(0);
  });

  it("combines the filters with active", async () => {
    const res = await list("?role=SUPPORT&active=true&search=a");
    expect(res.status).toBe(200);
    expect(res.body.data.every((user) => user.role === "SUPPORT")).toBe(true);
  });

  it("refuses an unknown role and a search that is too long", async () => {
    for (const query of ["?role=OWNER", `?search=${"x".repeat(101)}`]) {
      const res = await call(t, admin, "get", `${API}/users${query}`);
      expect(res.status, query).toBe(400);
    }
  });
});
