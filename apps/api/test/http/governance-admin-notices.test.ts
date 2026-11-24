import {
  ROLES,
  governanceNoticeListResponseSchema,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { RolePermissionRepository } from "../../src/auth/role-permission.repository.js";
import { PasswordHasher } from "../../src/auth/domain/password-hasher.js";
import { Database } from "../../src/database/database.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  call,
  demoSignIn,
  passwordSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const MATRIX = `${API}/governance/matrix`;
const NOTICES = `${API}/governance/notices`;
const SECOND_APPROVER = "approver.second@example.test";

/**
 * #383: the administrator could widen its own role alone, and from ADR 0058
 * step 6 it is the only role that reads the trail where that is recorded. So
 * the approvers are told, and two more actions are locked away from it.
 */
describe("governance: the administrator widening its own role (#383)", () => {
  let t: TestApp;
  const sessions = new Map<string, Browser>();
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
    // A second approver, to show the read state is each person's own.
    await t.app.get(UserRepository).create({
      email: SECOND_APPROVER,
      displayName: "Second Approver",
      role: "APPROVER",
      passwordHash: await t.app.get(PasswordHasher).hash(TEST_DEMO_PASSWORD),
    });
    sessions.set("approver2", await passwordSignIn(t, SECOND_APPROVER));
  });
  afterAll(async () => {
    await t.close();
  });
  const as = (who: string): Browser => {
    const found = sessions.get(who);
    if (!found) throw new Error(`no session for ${who}`);
    return found;
  };
  const cell = (role: Role, permission: string) =>
    `${MATRIX}/${role}/permissions/${permission}`;
  const set = (role: Role, permission: string, granted: boolean) =>
    call(t, as("SYSTEM_ADMIN"), "put", cell(role, permission), {
      csrf: true,
      body: { granted },
    });
  const copy = (fromRole: Role, toRole: Role) =>
    call(t, as("SYSTEM_ADMIN"), "post", `${MATRIX}/copy`, {
      csrf: true,
      body: { fromRole, toRole },
    });
  const notices = async (who = "APPROVER") => {
    const res = await call(t, as(who), "get", `${NOTICES}?pageSize=50`);
    expect(res.status, who).toBe(200);
    return governanceNoticeListResponseSchema.parse(res.body);
  };
  const noticeCount = async () => (await notices()).meta.total;
  const holds = (role: Role, permission: Permission) =>
    t.app.get(RolePermissionRepository).has(role, permission);

  describe("telling the approvers", () => {
    it("tells them when the administrator's role gains a permission, and the grant's row says so", async () => {
      const before = await noticeCount();
      expect((await set("SYSTEM_ADMIN", "orders.read", true)).status).toBe(200);
      try {
        const list = await notices();
        expect(list.meta.total).toBe(before + 1);
        const notice = list.data[0];
        expect(notice).toMatchObject({
          kind: "admin-role-widened",
          actorName: as("SYSTEM_ADMIN").session.user.displayName,
          permissions: ["orders.read"],
          fromRole: null,
          read: false,
        });
        const granted = (await auditEvents(t))
          .filter((e) => e.action === "governance.permission.granted")
          .at(-1);
        expect(granted).toMatchObject({
          entityId: "SYSTEM_ADMIN:orders.read",
          changes: { noticeId: notice?.id },
        });
      } finally {
        expect((await set("SYSTEM_ADMIN", "orders.read", false)).status).toBe(
          200,
        );
      }
    });

    it("writes nothing for a revocation, a grant to another role, or a grant already held", async () => {
      const before = await noticeCount();
      // The test above granted and revoked; these change no notice either.
      expect((await set("SUPPORT", "insights.read", true)).status).toBe(200);
      expect((await set("SUPPORT", "insights.read", false)).status).toBe(200);
      expect((await set("SYSTEM_ADMIN", "users.read", true)).status).toBe(200);
      expect(await noticeCount()).toBe(before);
    });

    it("tells them about a copy onto the administrator's role, with everything it gained", async () => {
      // The auditor reads only; with the administrator's own four it becomes a
      // source a copy onto the administrator accepts. At ADR 0058 step 6 the
      // auditor retires, and this takes another read-only source.
      const extra = [
        "roles.manage",
        "users.read",
        "users.manage",
        "settings.manage",
      ];
      for (const permission of extra) {
        expect((await set("AUDITOR", permission, true)).status).toBe(200);
      }
      const before = new Set(
        (
          await call(t, as("SYSTEM_ADMIN"), "get", MATRIX).then(
            (res) =>
              (
                res.body as {
                  data: { roles: { role: Role; permissions: string[] }[] };
                }
              ).data.roles,
          )
        ).find((r) => r.role === "SYSTEM_ADMIN")?.permissions,
      );
      try {
        expect((await copy("AUDITOR", "SYSTEM_ADMIN")).status).toBe(200);
        const notice = (await notices()).data[0];
        expect(notice).toMatchObject({
          kind: "admin-role-widened",
          fromRole: "AUDITOR",
          read: false,
        });
        expect(notice?.permissions.length).toBeGreaterThan(0);
        for (const permission of notice?.permissions ?? []) {
          expect(before.has(permission), permission).toBe(false);
        }
      } finally {
        const after = await call(t, as("SYSTEM_ADMIN"), "get", MATRIX);
        const admin = (
          after.body as {
            data: { roles: { role: Role; permissions: string[] }[] };
          }
        ).data.roles.find((r) => r.role === "SYSTEM_ADMIN");
        for (const permission of admin?.permissions ?? []) {
          if (!before.has(permission)) {
            await set("SYSTEM_ADMIN", permission, false);
          }
        }
        for (const permission of extra) {
          await set("AUDITOR", permission, false);
        }
      }
    });

    it("lets only the approvers read them, and marks one read for that person only", async () => {
      expect((await set("SYSTEM_ADMIN", "tracker.read", true)).status).toBe(
        200,
      );
      await set("SYSTEM_ADMIN", "tracker.read", false);
      for (const who of ["SUPPORT", "SYSTEM_ADMIN"]) {
        expect((await call(t, as(who), "get", NOTICES)).status, who).toBe(403);
      }
      const first = await notices();
      const notice = first.data[0];
      if (!notice) throw new Error("no notice");
      const read = await call(
        t,
        as("APPROVER"),
        "post",
        `${NOTICES}/${notice.id}/read`,
        { csrf: true },
      );
      expect(read.status).toBe(200);
      const after = await notices();
      expect(after.data.find((n) => n.id === notice.id)?.read).toBe(true);
      expect(after.meta.unread).toBe(first.meta.unread - 1);
      // The other approver still has it to read.
      const theirs = await notices("approver2");
      expect(theirs.data.find((n) => n.id === notice.id)?.read).toBe(false);
      const marked = (await auditEvents(t))
        .filter((e) => e.action === "governance.notice.read")
        .at(-1);
      expect(marked).toMatchObject({
        entityType: "GovernanceNotice",
        entityId: notice.id,
      });
      // The administrator can never mark one read for them.
      expect(
        (
          await call(
            t,
            as("SYSTEM_ADMIN"),
            "post",
            `${NOTICES}/${notice.id}/read`,
            { csrf: true },
          )
        ).status,
      ).toBe(403);
    });

    it("keeps no notice when the grant does not commit", async () => {
      const before = await noticeCount();
      const audit = t.app.get(AuditService);
      const spy = vi
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("audit is down"));
      try {
        const res = await set("SYSTEM_ADMIN", "insights.read", true);
        expect(res.status).toBe(500);
      } finally {
        spy.mockRestore();
      }
      expect(await noticeCount()).toBe(before);
      expect(await holds("SYSTEM_ADMIN", "insights.read")).toBe(false);
    });
  });

  describe("the two new locks, and the approvers' own", () => {
    it("refuses the administrator routing an SPR or taking in a document, and audits each refusal", async () => {
      for (const permission of ["spr.route", "documents.upload"]) {
        const res = await set("SYSTEM_ADMIN", permission, true);
        expect(res.status, permission).toBe(409);
        const refused = (await auditEvents(t))
          .filter((e) => e.action === "governance.permission.refused")
          .at(-1);
        expect(refused?.changes, permission).toMatchObject({
          permission,
          rule: "locked-cell",
          lock: "never",
        });
      }
    });

    it("refuses a copy that would give the administrator's role either, audits it, and tells no one", async () => {
      // The auditor with the administrator's own four is a source a copy onto
      // the administrator accepts (see the copy notice above), so the only
      // cell this copy breaks is the new lock.
      const extra = [
        "roles.manage",
        "users.read",
        "users.manage",
        "settings.manage",
      ];
      const permissionsOf = (role: Role) =>
        t.app.get(RolePermissionRepository).permissionsOf(role);
      for (const permission of ["spr.route", "documents.upload"] as const) {
        const given = [...extra, permission];
        for (const p of given) {
          expect((await set("AUDITOR", p, true)).status).toBe(200);
        }
        const before = await permissionsOf("SYSTEM_ADMIN");
        const told = await noticeCount();
        try {
          expect(
            (await copy("AUDITOR", "SYSTEM_ADMIN")).status,
            permission,
          ).toBe(409);
          const refused = (await auditEvents(t))
            .filter((e) => e.action === "governance.role.copy.refused")
            .at(-1);
          expect(refused?.changes, permission).toMatchObject({
            fromRole: "AUDITOR",
            toRole: "SYSTEM_ADMIN",
            rule: "locked-cell",
            permission,
            lock: "never",
          });
          expect(await holds("SYSTEM_ADMIN", permission)).toBe(false);
          expect(await noticeCount(), permission).toBe(told);
        } finally {
          for (const p of await permissionsOf("SYSTEM_ADMIN")) {
            if (!before.includes(p)) await set("SYSTEM_ADMIN", p, false);
          }
          for (const p of given) await set("AUDITOR", p, false);
        }
      }
    });

    it("keeps approvals.decide on for the approver role, on one cell and in a copy", async () => {
      expect((await set("APPROVER", "approvals.decide", false)).status).toBe(
        409,
      );
      expect((await copy("AUDITOR", "APPROVER")).status).toBe(409);
      const refused = (await auditEvents(t)).filter((e) =>
        [
          "governance.permission.refused",
          "governance.role.copy.refused",
        ].includes(e.action),
      );
      expect(refused.at(-2)?.changes).toMatchObject({
        role: "APPROVER",
        permission: "approvals.decide",
        lock: "always",
      });
      expect(refused.at(-1)?.changes).toMatchObject({
        toRole: "APPROVER",
        permission: "approvals.decide",
        lock: "always",
      });
      expect(await holds("APPROVER", "approvals.decide")).toBe(true);
    });

    it("repairs at the seed a locked cell broken outside the matrix, and records each repair once", async () => {
      const database = t.app.get(Database).client;
      await database.rolePermission.create({
        data: { role: "SYSTEM_ADMIN", permission: "documents.upload" },
      });
      await database.rolePermission.delete({
        where: {
          role_permission: { role: "APPROVER", permission: "approvals.decide" },
        },
      });
      await database.revokedRolePermission.create({
        data: { role: "APPROVER", permission: "approvals.decide" },
      });
      const from = (await auditEvents(t)).length;

      await runSeed(testConfig(), () => undefined);
      expect(await holds("SYSTEM_ADMIN", "documents.upload")).toBe(false);
      expect(await holds("APPROVER", "approvals.decide")).toBe(true);
      const repairs = (await auditEvents(t))
        .slice(from)
        .filter((e) => e.actor.kind === "system");
      expect(repairs).toHaveLength(2);
      expect(repairs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "governance.permission.revoked",
            entityId: "SYSTEM_ADMIN:documents.upload",
            changes: expect.objectContaining({
              rule: "locked-cell",
              lock: "never",
            }) as unknown,
          }),
          expect.objectContaining({
            action: "governance.permission.granted",
            entityId: "APPROVER:approvals.decide",
            changes: expect.objectContaining({
              rule: "locked-cell",
              lock: "always",
            }) as unknown,
          }),
        ]),
      );

      // A second run finds nothing to repair, and records nothing.
      const again = (await auditEvents(t)).length;
      await runSeed(testConfig(), () => undefined);
      expect(
        (await auditEvents(t))
          .slice(again)
          .filter((e) => e.action.startsWith("governance.permission.")),
      ).toEqual([]);
    });
  });

  describe("a user's role", () => {
    it("has no route that changes it, so no one can move their own account to another role", async () => {
      const admin = as("SYSTEM_ADMIN");
      const id = admin.session.user.id;
      for (const verb of ["put", "patch"] as const) {
        const res = await call(t, admin, verb, `${API}/users/${id}`, {
          csrf: true,
          body: { role: "APPROVER" },
        });
        expect(res.status, verb).toBe(404);
      }
      const me = await call(t, admin, "get", `${API}/users/${id}`);
      expect(me.body).toMatchObject({ data: { role: "SYSTEM_ADMIN" } });
    });
  });
});
