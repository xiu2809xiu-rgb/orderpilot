import { COOKIES, errorEnvelopeSchema } from "@orderpilot/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AccessTokens } from "../../src/auth/domain/access-token.js";
import { RefreshTokenRepository } from "../../src/sessions/refresh-token.repository.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
  withCookies,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

function codeOf(body: unknown): string {
  return errorEnvelopeSchema.parse(body).error.code;
}

describe("sign-in hardening", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  describe("login CSRF", () => {
    it("refuses a form post to demo-login and login, the way a hostile page would send one", async () => {
      const demo = await request(t.app.getHttpServer())
        .post(`${API}/auth/demo-login`)
        .set("Origin", "https://evil.example")
        .type("form")
        .send({ role: "SYSTEM_ADMIN" });
      expect(demo.status).toBe(403);
      expect(codeOf(demo.body)).toBe("CSRF_INVALID");
      expect(demo.headers["set-cookie"]).toBeUndefined();

      const login = await request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .type("form")
        .send({
          email: await emailForRole("AUDITOR"),
          password: TEST_DEMO_PASSWORD,
        });
      expect(login.status).toBe(403);
      expect(login.headers["set-cookie"]).toBeUndefined();
    });

    it("refuses JSON from an origin that is not ours, and accepts our own", async () => {
      const foreign = await request(t.app.getHttpServer())
        .post(`${API}/auth/demo-login`)
        .set("Origin", "https://evil.example")
        .send({ role: "AUDITOR" });
      expect(foreign.status).toBe(403);
      expect(foreign.headers["set-cookie"]).toBeUndefined();

      const ours = await request(t.app.getHttpServer())
        .post(`${API}/auth/demo-login`)
        .set("Origin", "http://localhost:5173")
        .send({ role: "AUDITOR" });
      expect(ours.status).toBe(200);
    });
  });

  describe("a flood of junk from an anonymous caller", () => {
    it("writes at most one audit row, with a bounded entity id", async () => {
      const before = await auditEvents(t);
      const junk = `${COOKIES.access}=junk`;
      for (let i = 0; i < 12; i += 1) {
        await request(t.app.getHttpServer())
          .get(`${API}/auth/me`)
          .set("Cookie", junk);
        await request(t.app.getHttpServer())
          .post(`${API}/auth/refresh`)
          .set("Cookie", `${COOKIES.refresh}=junk`);
      }
      await request(t.app.getHttpServer())
        .post(`${API}/users/${"a".repeat(6000)}/disable`)
        .set("Cookie", junk);
      const added = (await auditEvents(t)).slice(before.length);
      expect(
        added.filter((e) => e.action === "auth.access.refused").length,
      ).toBeLessThanOrEqual(1);
      expect(
        added.filter((e) => e.action === "auth.csrf.refused").length,
      ).toBeLessThanOrEqual(1);
      for (const e of added) expect(e.entityId.length).toBeLessThanOrEqual(200);
    });
  });

  describe("sign-out", () => {
    it("ends the sign-in named by the access cookie when no refresh cookie comes", async () => {
      const browser = await demoSignIn(t, "SUPPORT");
      const bare = withCookies(browser, { [COOKIES.refresh]: null });
      const out = await call(t, bare, "post", `${API}/auth/logout`, {
        csrf: true,
      });
      expect(out.status).toBe(200);
      const me = await call(t, browser, "get", `${API}/auth/me`);
      expect(me.status).toBe(401);
      const logouts = (await auditEvents(t)).filter(
        (e) =>
          e.action === "auth.logout" && e.entityId === browser.session.user.id,
      );
      expect(logouts.length).toBe(1);
    });
  });

  describe("a refresh that fails for a reason of ours", () => {
    it("keeps the cookies, so a live session is not signed out", async () => {
      const browser = await demoSignIn(t, "SUPPORT");
      const spy = vi
        .spyOn(t.app.get(RefreshTokenRepository), "findByHashForUpdate")
        .mockRejectedValueOnce(new Error("database down"));
      try {
        const res = await call(t, browser, "post", `${API}/auth/refresh`, {
          csrf: true,
        });
        expect(res.status).toBe(500);
        expect(res.headers["set-cookie"]).toBeUndefined();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("a token that names another user's sign-in", () => {
    it("is refused", async () => {
      const victim = await demoSignIn(t, "APPROVER");
      const admin = await demoSignIn(t, "SYSTEM_ADMIN");
      const tokens = new AccessTokens(t.config.auth.jwtSecret, 600);
      const forged = withCookies(victim, {
        [COOKIES.access]: (
          await tokens.sign({
            userId: admin.session.user.id,
            sessionId: sessionIdOf(victim),
            demo: true,
          })
        ).token,
      });
      const res = await call(t, forged, "get", `${API}/auth/me`);
      expect(res.status).toBe(401);
    });
  });
});

describe("a demo sign-in after DEMO_MODE is turned off", () => {
  let on: TestApp;
  let off: TestApp;
  beforeAll(async () => {
    await resetTestData();
    on = await createTestApp({ DEMO_MODE: "true" });
    off = await createTestApp({ DEMO_MODE: "false" });
  });
  afterAll(async () => {
    await on.close();
    await off.close();
  });

  it("stops working, and cannot be refreshed", async () => {
    const browser = await demoSignIn(on, "SYSTEM_ADMIN");
    expect((await call(on, browser, "get", `${API}/auth/me`)).status).toBe(200);

    const me = await call(off, browser, "get", `${API}/auth/me`);
    expect(me.status).toBe(401);
    const users = await call(off, browser, "get", `${API}/users`);
    expect(users.status).toBe(401);

    const refresh = await call(off, browser, "post", `${API}/auth/refresh`, {
      csrf: true,
    });
    expect(refresh.status).toBe(401);
    const events = await auditEvents(off);
    expect(
      events.some(
        (e) =>
          e.action === "auth.refresh.refused" &&
          (e.changes as { reason?: string } | null)?.reason === "demo-mode-off",
      ),
    ).toBe(true);
    // The family is revoked, so it is dead on the other instance too.
    expect((await call(on, browser, "get", `${API}/auth/me`)).status).toBe(401);
  });
});

function sessionIdOf(browser: { jar: Record<string, string> }): string {
  const payload = browser.jar[COOKIES.access]?.split(".")[1] ?? "";
  return (
    JSON.parse(Buffer.from(payload, "base64url").toString()) as { sid: string }
  ).sid;
}
