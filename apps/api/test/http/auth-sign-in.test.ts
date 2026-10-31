import {
  COOKIES,
  ROLES,
  errorEnvelopeSchema,
  sessionResponseSchema,
} from "@orderpilot/shared";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
} from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

function codeOf(body: unknown): string {
  return errorEnvelopeSchema.parse(body).error.code;
}

describe("sign-in", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ COOKIE_SECURE: "true" });
  });
  afterAll(async () => {
    await t.close();
  });

  describe("GET /auth/options", () => {
    it("lists the nine roles with their synthetic names when DEMO_MODE is on", async () => {
      const res = await request(t.app.getHttpServer()).get(
        `${API}/auth/options`,
      );
      expect(res.status).toBe(200);
      const data = (
        res.body as {
          data: { demoMode: boolean; demoRoles: { role: string }[] };
        }
      ).data;
      expect(data.demoMode).toBe(true);
      expect(data.demoRoles.map((r) => r.role)).toEqual([...ROLES]);
    });
  });

  describe("POST /auth/demo-login", () => {
    it.each(ROLES)(
      "signs in as %s, with the role's permissions",
      async (role) => {
        const res = await request(t.app.getHttpServer())
          .post(`${API}/auth/demo-login`)
          .send({ role });
        expect(res.status).toBe(200);
        const session = sessionResponseSchema.parse(res.body).data;
        expect(session.user.role).toBe(role);
        expect(session.demo).toBe(true);
        expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(
          Date.now(),
        );
      },
    );

    it("sets three cookies with the right flags", async () => {
      const res = await request(t.app.getHttpServer())
        .post(`${API}/auth/demo-login`)
        .send({ role: "SUPPORT" });
      const lines = res.headers["set-cookie"] as unknown as string[];
      const line = (name: string) =>
        lines.find((l) => l.startsWith(`${name}=`)) ?? "";
      const access = line(COOKIES.access);
      expect(access).toMatch(/HttpOnly/i);
      expect(access).toMatch(/Secure/i);
      expect(access).toMatch(/SameSite=Strict/i);
      expect(access).toMatch(/Path=\/(;|$)/);
      const refresh = line(COOKIES.refresh);
      expect(refresh).toMatch(/HttpOnly/i);
      expect(refresh).toMatch(/Secure/i);
      expect(refresh).toContain("Path=/api/v1/auth");
      const csrf = line(COOKIES.csrf);
      expect(csrf).not.toMatch(/HttpOnly/i);
      expect(csrf).toMatch(/Secure/i);
      expect(csrf).toMatch(/SameSite=Strict/i);
    });

    it("stores the refresh token as a hash, never the token", async () => {
      const browser = await demoSignIn(t, "FINANCE");
      const client = new pg.Client({
        connectionString: testConfig().database.url,
      });
      await client.connect();
      try {
        const { rows } = await client.query<{ tokenHash: string }>(
          'SELECT "tokenHash" FROM "RefreshToken"',
        );
        const token = browser.jar[COOKIES.refresh] ?? "";
        expect(token.length).toBeGreaterThan(20);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
          expect(row.tokenHash).not.toBe(token);
        }
      } finally {
        await client.end();
      }
    });

    it("refuses a role that does not exist and a missing body (validation)", async () => {
      for (const body of [{ role: "WIZARD" }, {}, { role: 7 }]) {
        const res = await request(t.app.getHttpServer())
          .post(`${API}/auth/demo-login`)
          .send(body);
        expect(res.status).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
    });

    it("writes an audit event for the sign-in", async () => {
      await demoSignIn(t, "AUDITOR");
      const events = (await auditEvents(t)).filter(
        (e) => e.action === "auth.demo-login",
      );
      expect(events.length).toBeGreaterThan(0);
      expect(events.at(-1)?.actor.kind).toBe("user");
    });
  });

  describe("POST /auth/login", () => {
    const password = TEST_DEMO_PASSWORD;

    it("signs in with the seeded email and password", async () => {
      const res = await request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: await emailForRole("MANAGEMENT"), password });
      expect(res.status).toBe(200);
      const session = sessionResponseSchema.parse(res.body).data;
      expect(session.user.role).toBe("MANAGEMENT");
      expect(session.demo).toBe(false);
    });

    it("answers an unknown user and a wrong password the same way, and audits both", async () => {
      const refused = async () =>
        (await auditEvents(t)).filter((e) => e.action === "auth.login.refused");
      const before = (await refused()).length;
      const wrong = await request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({
          email: await emailForRole("SUPPORT"),
          password: "not-the-password",
        });
      const unknown = await request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: "nobody@example.test", password: "not-the-password" });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      const a = errorEnvelopeSchema.parse(wrong.body).error;
      const b = errorEnvelopeSchema.parse(unknown.body).error;
      expect(a.code).toBe("INVALID_CREDENTIALS");
      expect({ ...a, traceId: "" }).toEqual({ ...b, traceId: "" });
      expect(wrong.headers["set-cookie"]).toBeUndefined();
      const after = await refused();
      expect(after.length).toBe(before + 2);
      // The attempted email is not kept: it may be a mistyped password.
      expect(JSON.stringify(after)).not.toContain("nobody@example.test");
    });

    it("takes about as long for an unknown user as for a wrong password", async () => {
      const time = async (email: string) => {
        const start = performance.now();
        await request(t.app.getHttpServer())
          .post(`${API}/auth/login`)
          .send({ email, password: "not-the-password" });
        return performance.now() - start;
      };
      const known = await emailForRole("SUPPORT");
      await time(known); // warm up
      const wrong = Math.min(
        await time(known),
        await time(known),
        await time(known),
      );
      const unknown = Math.min(
        await time("nobody@example.test"),
        await time("nobody@example.test"),
        await time("nobody@example.test"),
      );
      // Without the dummy hash the unknown user would answer in about 1 ms.
      expect(unknown).toBeGreaterThan(wrong * 0.4);
    });

    it("validates the body", async () => {
      const bodies = [
        {},
        { email: "not-an-email", password: "x" },
        { email: "a@example.test" },
        { email: "a@example.test", password: "" },
      ];
      for (const body of bodies) {
        const res = await request(t.app.getHttpServer())
          .post(`${API}/auth/login`)
          .send(body);
        expect(res.status).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("GET /auth/me", () => {
    it("is 401 without a session", async () => {
      const res = await call(t, null, "get", `${API}/auth/me`);
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe("UNAUTHENTICATED");
    });

    it("returns the signed-in session", async () => {
      const browser = await demoSignIn(t, "WAREHOUSE");
      const res = await call(t, browser, "get", `${API}/auth/me`);
      expect(res.status).toBe(200);
      const session = sessionResponseSchema.parse(res.body).data;
      expect(session.user.id).toBe(browser.session.user.id);
      expect(session.permissions).toEqual(browser.session.permissions);
    });
  });
});

describe("sign-in with DEMO_MODE off", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ DEMO_MODE: "false" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("offers no roles and the demo route does not exist", async () => {
    const options = await request(t.app.getHttpServer()).get(
      `${API}/auth/options`,
    );
    expect((options.body as { data: unknown }).data).toEqual({
      demoMode: false,
      demoRoles: [],
    });
    const res = await request(t.app.getHttpServer())
      .post(`${API}/auth/demo-login`)
      .send({ role: "SYSTEM_ADMIN" });
    expect(res.status).toBe(404);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("still signs in with a password", async () => {
    const res = await request(t.app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({
        email: await emailForRole("SYSTEM_ADMIN"),
        password: TEST_DEMO_PASSWORD,
      });
    expect(res.status).toBe(200);
  });
});

describe("the sign-in rate limit", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ AUTH_RATE_LIMIT_MAX_REQUESTS: "3" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("stops the fourth attempt, while other routes stay open", async () => {
    const attempt = () =>
      request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: "nobody@example.test", password: "x" });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(codeOf(limited.body)).toBe("RATE_LIMITED");
    const other = await request(t.app.getHttpServer()).get(
      `${API}/auth/options`,
    );
    expect(other.status).toBe(200);
  });
});
