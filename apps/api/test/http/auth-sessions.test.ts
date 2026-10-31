import {
  COOKIES,
  errorEnvelopeSchema,
  sessionResponseSchema,
} from "@orderpilot/shared";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { AccessTokens } from "../../src/auth/domain/access-token.js";
import {
  API,
  auditEvents,
  browserFrom,
  call,
  demoSignIn,
  type Browser,
  withCookies,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

function codeOf(body: unknown): string {
  return errorEnvelopeSchema.parse(body).error.code;
}

async function refresh(t: TestApp, browser: Browser) {
  const res = await call(t, browser, "post", `${API}/auth/refresh`, {
    csrf: true,
  });
  return res;
}

describe("sessions", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  describe("refresh rotation", () => {
    it("issues a new pair and a session, and the old token stops working", async () => {
      const first = await demoSignIn(t, "SUPPORT");
      const res = await refresh(t, first);
      expect(res.status).toBe(200);
      const session = sessionResponseSchema.parse(res.body).data;
      expect(session.user.id).toBe(first.session.user.id);
      expect(session.demo).toBe(true);
      const second = browserFrom(session, res.headers["set-cookie"], first.jar);
      expect(second.jar[COOKIES.refresh]).not.toBe(first.jar[COOKIES.refresh]);
      expect(second.jar[COOKIES.access]).not.toBe(first.jar[COOKIES.access]);
      // The new pair works.
      expect((await refresh(t, second)).status).toBe(200);
    });

    it("needs the CSRF header", async () => {
      const browser = await demoSignIn(t, "SUPPORT");
      const res = await call(t, browser, "post", `${API}/auth/refresh`);
      expect(res.status).toBe(403);
      expect(codeOf(res.body)).toBe("CSRF_INVALID");
    });

    it("is 401 with no refresh cookie", async () => {
      let browser = await demoSignIn(t, "SUPPORT");
      browser = withCookies(browser, { [COOKIES.refresh]: null });
      const res = await refresh(t, browser);
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe("UNAUTHENTICATED");
    });

    it("is 401 for a token that never existed", async () => {
      let browser = await demoSignIn(t, "SUPPORT");
      browser = withCookies(browser, {
        [COOKIES.refresh]: "not-a-token-we-issued",
      });
      const res = await refresh(t, browser);
      expect(res.status).toBe(401);
    });

    it("revokes the whole family when a used token comes back, and audits it", async () => {
      const first = await demoSignIn(t, "FINANCE");
      const okRes = await refresh(t, first);
      const second = browserFrom(
        sessionResponseSchema.parse(okRes.body).data,
        okRes.headers["set-cookie"],
        first.jar,
      );
      // A thief (or a stale tab) presents the first refresh token again.
      const reuse = await refresh(t, first);
      expect(reuse.status).toBe(401);
      expect(codeOf(reuse.body)).toBe("REFRESH_REUSED");
      // The legitimate holder of the newest token is out too.
      const after = await refresh(t, second);
      expect(after.status).toBe(401);
      // And so is the newest access token, at its very next request.
      const me = await call(t, second, "get", `${API}/auth/me`);
      expect(me.status).toBe(401);
      const events = (await auditEvents(t)).filter(
        (e) => e.action === "auth.refresh.reuse-detected",
      );
      expect(events.length).toBe(1);
      expect(events[0]?.entityId).toBe(first.session.user.id);
    });
  });

  describe("sign-out", () => {
    it("revokes the refresh token and the access token, and audits it", async () => {
      const browser = await demoSignIn(t, "LOGISTICS");
      const out = await call(t, browser, "post", `${API}/auth/logout`, {
        csrf: true,
      });
      expect(out.status).toBe(200);
      expect(out.body).toEqual({ data: { ok: true } });
      const cleared = (out.headers["set-cookie"] as unknown as string[]).join(
        "\n",
      );
      expect(cleared).toContain(`${COOKIES.refresh}=;`);
      // The cookies the browser kept are dead on arrival.
      const me = await call(t, browser, "get", `${API}/auth/me`);
      expect(me.status).toBe(401);
      expect((await refresh(t, browser)).status).toBe(401);
      expect(
        (await auditEvents(t)).filter((e) => e.action === "auth.logout").length,
      ).toBeGreaterThan(0);
    });

    it("needs the CSRF header", async () => {
      const browser = await demoSignIn(t, "LOGISTICS");
      const res = await call(t, browser, "post", `${API}/auth/logout`);
      expect(res.status).toBe(403);
      expect(codeOf(res.body)).toBe("CSRF_INVALID");
      // Still signed in.
      expect((await call(t, browser, "get", `${API}/auth/me`)).status).toBe(
        200,
      );
    });

    it("is harmless to repeat, and works after the access token expired", async () => {
      let browser = await demoSignIn(t, "LOGISTICS");
      browser = withCookies(browser, { [COOKIES.access]: null });
      for (let i = 0; i < 2; i++) {
        const res = await call(t, browser, "post", `${API}/auth/logout`, {
          csrf: true,
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("the access token", () => {
    it("is refused when expired, with SESSION_EXPIRED, and not audited", async () => {
      let browser = await demoSignIn(t, "WAREHOUSE");
      const tokens = new AccessTokens(t.config.auth.jwtSecret, 60);
      const { token } = await tokens.sign({
        userId: browser.session.user.id,
        sessionId: "00000000-0000-4000-8000-000000000000",
        demo: true,
        now: new Date(Date.now() - 3_600_000),
      });
      browser = withCookies(browser, { [COOKIES.access]: token });
      const before = (await auditEvents(t)).length;
      const res = await call(t, browser, "get", `${API}/auth/me`);
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe("SESSION_EXPIRED");
      expect((await auditEvents(t)).length).toBe(before);
    });

    it("is refused when signed with another secret, and audited", async () => {
      let browser = await demoSignIn(t, "WAREHOUSE");
      const forged = new AccessTokens(
        "another-secret-another-secret-123456",
        600,
      );
      browser = withCookies(browser, {
        [COOKIES.access]: (
          await forged.sign({
            userId: browser.session.user.id,
            sessionId: "00000000-0000-4000-8000-000000000000",
            demo: false,
          })
        ).token,
      });
      const before = (await auditEvents(t)).length;
      const res = await call(t, browser, "get", `${API}/auth/me`);
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe("UNAUTHENTICATED");
      const events = await auditEvents(t);
      expect(events.length).toBe(before + 1);
      expect(events.at(-1)?.action).toBe("auth.access.refused");
    });

    it("refuses a token that names the none algorithm or a different HMAC", async () => {
      let browser = await demoSignIn(t, "WAREHOUSE");
      const secret = new TextEncoder().encode(t.config.auth.jwtSecret);
      const claims = { sid: "00000000-0000-4000-8000-000000000000" };
      const hs512 = await new SignJWT(claims)
        .setProtectedHeader({ alg: "HS512" })
        .setSubject(browser.session.user.id)
        .setIssuer("orderpilot-api")
        .setAudience("orderpilot-web")
        .setExpirationTime("10m")
        .sign(secret);
      const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
        "base64url",
      );
      const payload = Buffer.from(
        JSON.stringify({
          sub: browser.session.user.id,
          sid: claims.sid,
          iss: "orderpilot-api",
          aud: "orderpilot-web",
          exp: Math.floor(Date.now() / 1000) + 600,
        }),
      ).toString("base64url");
      for (const token of [hs512, `${header}.${payload}.`]) {
        browser = withCookies(browser, { [COOKIES.access]: token });
        const res = await call(t, browser, "get", `${API}/auth/me`);
        expect(res.status).toBe(401);
      }
    });

    it("is refused for a sign-in that no longer exists", async () => {
      let browser = await demoSignIn(t, "WAREHOUSE");
      const tokens = new AccessTokens(t.config.auth.jwtSecret, 600);
      browser = withCookies(browser, {
        [COOKIES.access]: (
          await tokens.sign({
            userId: browser.session.user.id,
            sessionId: "00000000-0000-4000-8000-000000000000",
            demo: true,
          })
        ).token,
      });
      const res = await call(t, browser, "get", `${API}/auth/me`);
      expect(res.status).toBe(401);
    });
  });

  describe("CSRF", () => {
    let admin: Browser;
    beforeAll(async () => {
      admin = await demoSignIn(t, "SYSTEM_ADMIN");
    });
    const target = `${API}/users/00000000-0000-4000-8000-000000000001/disable`;

    it("refuses an unsafe call with no header, with a wrong header and with an unsigned pair, and audits each", async () => {
      const before = (await auditEvents(t)).filter(
        (e) => e.action === "auth.csrf.refused",
      ).length;
      const none = await call(t, admin, "post", target);
      const wrong = await call(t, admin, "post", target, { csrf: "abc" });
      // Cookie and header agree, but the token was not minted by the API.
      const unsigned = {
        ...admin,
        jar: { ...admin.jar, [COOKIES.csrf]: "x.y" },
      };
      const forged = await call(t, unsigned, "post", target, { csrf: "x.y" });
      for (const res of [none, wrong, forged]) {
        expect(res.status).toBe(403);
        expect(codeOf(res.body)).toBe("CSRF_INVALID");
      }
      const after = (await auditEvents(t)).filter(
        (e) => e.action === "auth.csrf.refused",
      ).length;
      expect(after).toBe(before + 3);
    });

    it("lets a safe method through without the header", async () => {
      const res = await call(t, admin, "get", `${API}/users`);
      expect(res.status).toBe(200);
    });

    it("lets a call with the right header reach the route", async () => {
      const res = await call(t, admin, "post", target, { csrf: true });
      // The route ran: the user does not exist.
      expect(res.status).toBe(404);
    });
  });

  it("leaves an audit chain that verifies", async () => {
    const report = await t.app.get(AuditService).verify();
    expect(report.ok).toBe(true);
  });
});
