import { Controller, Get, Post } from "@nestjs/common";
import {
  COOKIES,
  ROLES,
  errorEnvelopeSchema,
  type Role,
} from "@orderpilot/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  Authenticated,
  Public,
  RequirePermission,
} from "../../src/auth/decorators.js";
import {
  PermissionPolicy,
  type AccessRequest,
} from "../../src/auth/permission-policy.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
  withCookies,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

function codeOf(body: unknown): string {
  return errorEnvelopeSchema.parse(body).error.code;
}

/** Routes that exist only to show how the guards treat each kind of route. */
@Controller("probe")
class ProbeController {
  @Get("open")
  @Public()
  open() {
    return { data: "open" };
  }

  @Get("unmarked")
  unmarked() {
    return { data: "unmarked" };
  }

  @Get("any-user")
  @Authenticated()
  anyUser() {
    return { data: "any-user" };
  }

  @Get("settings")
  @RequirePermission("settings.manage")
  settings() {
    return { data: "settings" };
  }

  @Post("write")
  @RequirePermission("users.manage")
  write() {
    return { data: "written" };
  }
}

const ROUTES_ON_USERS = (id: string) =>
  [
    ["get", `${API}/users`],
    ["get", `${API}/users/${id}`],
    ["post", `${API}/users/${id}/disable`],
    ["post", `${API}/users/${id}/enable`],
  ] as const;

describe("the guards", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [ProbeController]);
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
  const anyId = () => as("SUPPORT").session.user.id;

  describe("deny by default", () => {
    it("lets a @Public route through with no session", async () => {
      const res = await call(t, null, "get", `${API}/probe/open`);
      expect(res.status).toBe(200);
    });

    it("keeps the health probes, the docs and the system checks public", async () => {
      for (const path of ["/health", "/health/live", "/health/ready"]) {
        expect((await call(t, null, "get", path)).status, path).toBe(200);
      }
      expect((await call(t, null, "get", "/api/docs")).status).toBe(200);
      expect((await call(t, null, "get", `${API}/system/checks`)).status).toBe(
        200,
      );
    });

    it("refuses a route nobody marked: 401 anonymous, 403 signed in, audited", async () => {
      const anonymous = await call(t, null, "get", `${API}/probe/unmarked`);
      expect(anonymous.status).toBe(401);
      const before = (await auditEvents(t)).filter(
        (e) => e.action === "auth.permission.refused",
      ).length;
      const signedIn = await call(
        t,
        as("SYSTEM_ADMIN"),
        "get",
        `${API}/probe/unmarked`,
      );
      expect(signedIn.status).toBe(403);
      expect(codeOf(signedIn.body)).toBe("FORBIDDEN");
      const events = (await auditEvents(t)).filter(
        (e) => e.action === "auth.permission.refused",
      );
      expect(events.length).toBe(before + 1);
      expect(events.at(-1)?.changes).toMatchObject({
        reason: "route-has-no-access-rule",
      });
    });

    it("lets any signed-in user use an @Authenticated route", async () => {
      expect((await call(t, null, "get", `${API}/probe/any-user`)).status).toBe(
        401,
      );
      for (const role of ROLES) {
        const res = await call(t, as(role), "get", `${API}/probe/any-user`);
        expect(res.status, role).toBe(200);
      }
    });
  });

  describe("permissions", () => {
    it("lets only the roles that hold the permission through", async () => {
      for (const role of ROLES) {
        const res = await call(t, as(role), "get", `${API}/probe/settings`);
        expect(res.status, role).toBe(role === "SYSTEM_ADMIN" ? 200 : 403);
      }
    });

    it("audits every refusal with who, what and why", async () => {
      const before = (await auditEvents(t)).length;
      const res = await call(t, as("AUDITOR"), "get", `${API}/probe/settings`);
      expect(res.status).toBe(403);
      const events = await auditEvents(t);
      expect(events.length).toBe(before + 1);
      const event = events.at(-1);
      expect(event?.action).toBe("auth.permission.refused");
      expect(event?.actor).toMatchObject({
        kind: "user",
        userId: as("AUDITOR").session.user.id,
        role: "AUDITOR",
      });
      expect(event?.changes).toMatchObject({ permission: "settings.manage" });
      expect(event?.traceId).toBe(res.headers["x-request-id"]);
    });

    it("does not audit an anonymous call to a protected route, so the trail cannot be flooded", async () => {
      const before = (await auditEvents(t)).length;
      for (let i = 0; i < 5; i++) {
        expect((await call(t, null, "get", `${API}/users`)).status).toBe(401);
      }
      expect((await auditEvents(t)).length).toBe(before);
    });

    it("asks the policy behind PermissionPolicy, so a richer one can replace the matrix", async () => {
      const seen: AccessRequest[] = [];
      const custom = await createTestApp({}, [ProbeController], (builder) =>
        builder.overrideProvider(PermissionPolicy).useValue({
          decide: (request: AccessRequest) => {
            seen.push(request);
            return Promise.resolve({
              allowed: request.method === "GET",
              reason: "only reads",
            });
          },
        }),
      );
      try {
        const admin = await demoSignIn(custom, "WAREHOUSE");
        // The matrix would refuse a warehouse user; the custom policy allows a read.
        expect(
          (await call(custom, admin, "get", `${API}/probe/settings`)).status,
        ).toBe(200);
        expect(
          (
            await call(custom, admin, "post", `${API}/probe/write`, {
              csrf: true,
            })
          ).status,
        ).toBe(403);
        expect(seen.map((s) => s.permission)).toEqual([
          "settings.manage",
          "users.manage",
        ]);
        expect(seen[0]?.user.role).toBe("WAREHOUSE");
      } finally {
        await custom.close();
      }
    });
  });

  describe("the users routes", () => {
    it("are 401 without a session", async () => {
      for (const [method, path] of ROUTES_ON_USERS(anyId())) {
        const res = await call(t, null, method, path);
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(codeOf(res.body)).toBe("UNAUTHENTICATED");
      }
    });

    it("are 403 for every role without the permission", async () => {
      for (const role of ROLES.filter((r) => r !== "SYSTEM_ADMIN")) {
        for (const [method, path] of ROUTES_ON_USERS(anyId())) {
          const res = await call(t, as(role), method, path, { csrf: true });
          expect(res.status, `${role} ${method} ${path}`).toBe(403);
          expect(codeOf(res.body)).toBe("FORBIDDEN");
        }
      }
    });

    it("list users a page at a time, without hashes", async () => {
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "get",
        `${API}/users?pageSize=4`,
      );
      expect(res.status).toBe(200);
      const body = res.body as {
        data: Record<string, unknown>[];
        meta: { total: number; pageSize: number };
      };
      expect(body.data).toHaveLength(4);
      expect(body.meta).toMatchObject({ total: 9, pageSize: 4 });
      expect(JSON.stringify(body)).not.toMatch(/passwordHash|argon2/);
    });

    it("validate the page query and the id", async () => {
      const admin = as("SYSTEM_ADMIN");
      const badPage = await call(t, admin, "get", `${API}/users?page=0`);
      expect(badPage.status).toBe(400);
      expect(codeOf(badPage.body)).toBe("VALIDATION_FAILED");
      for (const [method, path] of [
        ["get", `${API}/users/not-a-uuid`],
        ["post", `${API}/users/not-a-uuid/disable`],
        ["post", `${API}/users/not-a-uuid/enable`],
      ] as const) {
        const res = await call(t, admin, method, path, { csrf: true });
        expect(res.status, path).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
    });

    it("answer 404 for a user that does not exist", async () => {
      const missing = "00000000-0000-4000-8000-00000000dead";
      const admin = as("SYSTEM_ADMIN");
      expect(
        (await call(t, admin, "get", `${API}/users/${missing}`)).status,
      ).toBe(404);
      expect(
        (
          await call(t, admin, "post", `${API}/users/${missing}/disable`, {
            csrf: true,
          })
        ).status,
      ).toBe(404);
    });

    it("read one user", async () => {
      const res = await call(
        t,
        as("SYSTEM_ADMIN"),
        "get",
        `${API}/users/${anyId()}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { id: anyId(), role: "SUPPORT", disabled: false },
      });
    });
  });

  describe("disabling a user", () => {
    it("ends their sessions at the next request, blocks sign-in and refresh, and enabling restores sign-in", async () => {
      const admin = as("SYSTEM_ADMIN");
      const victim = await demoSignIn(t, "FINANCE");
      const id = victim.session.user.id;
      expect((await call(t, victim, "get", `${API}/auth/me`)).status).toBe(200);

      const noCsrf = await call(t, admin, "post", `${API}/users/${id}/disable`);
      expect(noCsrf.status).toBe(403);

      const res = await call(t, admin, "post", `${API}/users/${id}/disable`, {
        csrf: true,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: { id, disabled: true } });

      // The very next request with the access token they already hold.
      const me = await call(t, victim, "get", `${API}/auth/me`);
      expect(me.status).toBe(401);
      // The refresh token is revoked.
      const refresh = await call(t, victim, "post", `${API}/auth/refresh`, {
        csrf: true,
      });
      expect(refresh.status).toBe(401);
      // Neither sign-in route lets them in, and the answer is the usual one.
      const demo = await request(t.app.getHttpServer())
        .post(`${API}/auth/demo-login`)
        .send({ role: "FINANCE" });
      expect(demo.status).toBe(401);
      const password = await request(t.app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({
          email: await emailForRole("FINANCE"),
          password: TEST_DEMO_PASSWORD,
        });
      expect(password.status).toBe(401);
      expect(codeOf(password.body)).toBe("INVALID_CREDENTIALS");

      // Disabling again changes nothing and writes nothing.
      const before = (await auditEvents(t)).length;
      const again = await call(t, admin, "post", `${API}/users/${id}/disable`, {
        csrf: true,
      });
      expect(again.status).toBe(200);
      expect((await auditEvents(t)).length).toBe(before);

      const enabled = await call(
        t,
        admin,
        "post",
        `${API}/users/${id}/enable`,
        {
          csrf: true,
        },
      );
      expect(enabled.status).toBe(200);
      expect(enabled.body).toMatchObject({ data: { id, disabled: false } });
      // Old sessions stay dead; a new sign-in works.
      expect((await call(t, victim, "get", `${API}/auth/me`)).status).toBe(401);
      expect((await demoSignIn(t, "FINANCE")).session.user.id).toBe(id);

      const actions = (await auditEvents(t))
        .filter((e) => e.entityId === id)
        .map((e) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining(["user.disabled", "user.enabled"]),
      );
    });

    it("stops a user whose flag was set without revoking their tokens (the guard checks the user itself)", async () => {
      const victim = await demoSignIn(t, "APPROVER");
      const users = t.app.get(UserRepository);
      await users.setDisabledAt(victim.session.user.id, new Date());
      try {
        const res = await call(t, victim, "get", `${API}/auth/me`);
        expect(res.status).toBe(401);
        const events = (await auditEvents(t)).filter(
          (e) => e.action === "auth.access.refused",
        );
        expect(events.at(-1)?.changes).toMatchObject({
          reason: "user-disabled",
        });
      } finally {
        await users.setDisabledAt(victim.session.user.id, null);
      }
    });

    it("does not let an administrator disable themselves", async () => {
      const admin = as("SYSTEM_ADMIN");
      const res = await call(
        t,
        admin,
        "post",
        `${API}/users/${admin.session.user.id}/disable`,
        { csrf: true },
      );
      expect(res.status).toBe(409);
      expect(codeOf(res.body)).toBe("CONFLICT");
    });

    it("keeps the user and their audit trail: nothing is ever deleted", async () => {
      const list = await call(t, as("SYSTEM_ADMIN"), "get", `${API}/users`);
      expect((list.body as { meta: { total: number } }).meta.total).toBe(9);
    });
  });

  it("has no cookie left to forge: a bare refresh cookie alone cannot reach a protected route", async () => {
    const browser = withCookies(as("SYSTEM_ADMIN"), { [COOKIES.access]: null });
    const res = await call(t, browser, "get", `${API}/users`);
    expect(res.status).toBe(401);
  });

  it("leaves an audit chain that verifies", async () => {
    const report = await t.app.get(AuditService).verify();
    expect(report.ok).toBe(true);
    expect(report.checked).toBeGreaterThan(20);
  });
});
