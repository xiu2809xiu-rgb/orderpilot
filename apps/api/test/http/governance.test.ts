import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
  errorEnvelopeSchema,
  matrixSchema,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RolePermissionRepository } from "../../src/auth/role-permission.repository.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const MATRIX = `${API}/governance/matrix`;

describe("governance: the role-permission matrix over HTTP", () => {
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
  const put = (role: Role, path: string, body: object) =>
    call(t, as(role), "put", path, { csrf: true, body });
  const post = (role: Role, path: string, body: object) =>
    call(t, as(role), "post", path, { csrf: true, body });
  const access = async (role: Role) => {
    const res = await call(t, as("SYSTEM_ADMIN"), "get", MATRIX);
    const parsed = matrixSchema.parse((res.body as { data: unknown }).data);
    const found = parsed.roles.find((r) => r.role === role);
    if (!found) throw new Error(`no row for ${role}`);
    return found;
  };

  describe("reading", () => {
    it("returns every role with what the table holds, and the locked cells", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "get", MATRIX);
      expect(res.status).toBe(200);
      const matrix = matrixSchema.parse((res.body as { data: unknown }).data);
      expect(matrix.roles.map((r) => r.role)).toEqual([...ROLES]);
      for (const row of matrix.roles) {
        expect(new Set(row.permissions)).toEqual(
          new Set(DEFAULT_ROLE_PERMISSIONS[row.role]),
        );
      }
      expect(matrix.locked.length).toBeGreaterThan(0);
    });

    it("says in the default matrix that the system admin never approves, posts or pays", async () => {
      const admin = await access("SYSTEM_ADMIN");
      for (const permission of [
        "approvals.decide",
        "payments.confirm",
        "payments.post",
      ] as const) {
        expect(admin.permissions).not.toContain(permission);
      }
    });

    it("lets an auditor read but not change it", async () => {
      expect((await call(t, as("AUDITOR"), "get", MATRIX)).status).toBe(200);
      const res = await put(
        "AUDITOR",
        `${MATRIX}/SUPPORT/permissions/orders.read`,
        { granted: false },
      );
      expect(res.status).toBe(403);
    });
  });

  describe("a direct API call without the right", () => {
    it("is refused with the standard envelope and a trace id, and audited", async () => {
      const before = (await auditEvents(t)).filter(
        (e) => e.action === "auth.permission.refused",
      ).length;
      const res = await call(t, as("WAREHOUSE"), "get", MATRIX);
      expect(res.status).toBe(403);
      const { error } = errorEnvelopeSchema.parse(res.body);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.details).toBeNull();
      expect(error.traceId.length).toBeGreaterThan(0);
      const refused = (await auditEvents(t)).filter(
        (e) => e.action === "auth.permission.refused",
      );
      expect(refused.length).toBe(before + 1);
      expect(refused.at(-1)?.traceId).toBe(error.traceId);
    });

    it("is refused for a change too, and nothing changes", async () => {
      const before = await access("SUPPORT");
      const res = await put(
        "SUPPORT",
        `${MATRIX}/SUPPORT/permissions/payments.post`,
        { granted: true },
      );
      expect(res.status).toBe(403);
      expect(await access("SUPPORT")).toEqual(before);
    });

    it("asks for a session first", async () => {
      expect((await call(t, null, "get", MATRIX)).status).toBe(401);
    });
  });

  describe("changing a permission", () => {
    it("grants and revokes for real, audits each, and the guard follows at once", async () => {
      expect((await call(t, as("SUPPORT"), "get", `${API}/users`)).status).toBe(
        403,
      );
      const grant = await put(
        "SYSTEM_ADMIN",
        `${MATRIX}/SUPPORT/permissions/users.read`,
        { granted: true },
      );
      expect(grant.status).toBe(200);
      expect((await access("SUPPORT")).permissions).toContain("users.read");
      expect((await call(t, as("SUPPORT"), "get", `${API}/users`)).status).toBe(
        200,
      );

      const revoke = await put(
        "SYSTEM_ADMIN",
        `${MATRIX}/SUPPORT/permissions/users.read`,
        { granted: false },
      );
      expect(revoke.status).toBe(200);
      expect((await call(t, as("SUPPORT"), "get", `${API}/users`)).status).toBe(
        403,
      );

      const actions = (await auditEvents(t))
        .filter((e) => e.entityId === "SUPPORT:users.read")
        .map((e) => e.action);
      expect(actions).toEqual([
        "governance.permission.granted",
        "governance.permission.revoked",
      ]);
    });

    it("writes no audit event when nothing changes", async () => {
      const count = () =>
        auditEvents(t).then(
          (events) =>
            events.filter((e) => e.action.startsWith("governance.")).length,
        );
      const before = await count();
      await put("SYSTEM_ADMIN", `${MATRIX}/SUPPORT/permissions/orders.read`, {
        granted: true,
      });
      expect(await count()).toBe(before);
    });

    it("refuses to give the system admin a right to approve, post or pay", async () => {
      for (const permission of [
        "approvals.decide",
        "payments.confirm",
        "payments.post",
      ]) {
        const res = await put(
          "SYSTEM_ADMIN",
          `${MATRIX}/SYSTEM_ADMIN/permissions/${permission}`,
          { granted: true },
        );
        expect(res.status, permission).toBe(409);
      }
    });

    it("refuses to take roles.manage from the system admin", async () => {
      const res = await put(
        "SYSTEM_ADMIN",
        `${MATRIX}/SYSTEM_ADMIN/permissions/roles.manage`,
        { granted: false },
      );
      expect(res.status).toBe(409);
    });

    it("rejects a permission or role the platform does not know", async () => {
      const unknownPermission = await put(
        "SYSTEM_ADMIN",
        `${MATRIX}/SUPPORT/permissions/nothing.here`,
        { granted: true },
      );
      expect(unknownPermission.status).toBe(400);
      const unknownRole = await put(
        "SYSTEM_ADMIN",
        `${MATRIX}/NOBODY/permissions/orders.read`,
        { granted: true },
      );
      expect(unknownRole.status).toBe(400);
    });
  });

  describe("the data scope", () => {
    it("starts with the product manager on their brands", async () => {
      expect((await access("PRODUCT_MANAGER")).dataScope).toBe("brands");
      expect((await access("FINANCE")).dataScope).toBe("all");
    });

    it("changes and is audited", async () => {
      const res = await put("SYSTEM_ADMIN", `${MATRIX}/APPROVER/data-scope`, {
        dataScope: "own",
      });
      expect(res.status).toBe(200);
      expect((await access("APPROVER")).dataScope).toBe("own");
      const event = (await auditEvents(t)).find(
        (e) => e.action === "governance.data-scope.changed",
      );
      expect(event?.entityId).toBe("APPROVER");
    });
  });

  describe("copying a role", () => {
    it("makes the target hold what the source holds, with its data scope", async () => {
      const res = await post("SYSTEM_ADMIN", `${MATRIX}/copy`, {
        fromRole: "SUPPORT",
        toRole: "LOGISTICS",
      });
      expect(res.status).toBe(200);
      const [source, target] = [
        await access("SUPPORT"),
        await access("LOGISTICS"),
      ];
      expect(new Set(target.permissions)).toEqual(new Set(source.permissions));
      expect(target.dataScope).toBe(source.dataScope);
      const events = (await auditEvents(t)).filter(
        (e) => e.action === "governance.role.copied",
      );
      expect(events).toHaveLength(1);
    });

    it("refuses a copy onto itself, and a copy that would break a locked cell", async () => {
      const same = await post("SYSTEM_ADMIN", `${MATRIX}/copy`, {
        fromRole: "FINANCE",
        toRole: "FINANCE",
      });
      expect(same.status).toBe(409);
      const onAdmin = await post("SYSTEM_ADMIN", `${MATRIX}/copy`, {
        fromRole: "FINANCE",
        toRole: "SYSTEM_ADMIN",
      });
      expect(onAdmin.status).toBe(409);
      expect((await access("SYSTEM_ADMIN")).permissions).toContain(
        "roles.manage",
      );
    });
  });

  describe("masking on the server", () => {
    const sample = (role: Role) =>
      call(t, as(role), "get", `${API}/governance/masking/sample`);

    it("sends the note in full to a role the rule lists", async () => {
      const res = await sample("SUPPORT");
      expect(res.status).toBe(200);
      const body = res.body as {
        data: {
          records: { note: { masked: boolean; value: string | null } }[];
        };
        meta: { mock: boolean };
      };
      expect(body.meta.mock).toBe(true);
      expect(body.data.records[0]?.note.masked).toBe(false);
      expect(body.data.records[0]?.note.value).toBeTruthy();
    });

    it("never puts the note in the response for a role it hides it from", async () => {
      const visible = await sample("SUPPORT");
      const notes = (
        visible.body as { data: { records: { note: { value: string } }[] } }
      ).data.records.map((r) => r.note.value);
      const res = await sample("WAREHOUSE");
      expect(res.status).toBe(200);
      for (const note of notes) expect(res.text).not.toContain(note);
      const first = (
        res.body as {
          data: { records: { note: { masked: boolean; reason: string } }[] };
        }
      ).data.records[0];
      expect(first?.note).toMatchObject({
        masked: true,
        value: null,
        reason: "role",
      });
    });

    // F-8: the rule's roles are a row of the matrix, not code.
    const NOTE = "masking.customerNote";
    const noteCell = (role: Role) => `${MATRIX}/${role}/permissions/${NOTE}`;
    interface Sample {
      data: {
        rules: { field: string; visibleTo: Role[] }[];
        records: {
          note: { masked: boolean; value: string | null; reason: string };
        }[];
      };
    }
    const sampleOf = async (role: Role) => (await sample(role)).body as Sample;
    const noteRule = (body: Sample) =>
      body.data.rules.find((rule) => rule.field === "sample.customerNote");

    it("takes who sees the note from the matrix", async () => {
      const res = await call(t, as("SYSTEM_ADMIN"), "get", MATRIX);
      const matrix = matrixSchema.parse((res.body as { data: unknown }).data);
      const holders = matrix.roles
        .filter((access) =>
          (access.permissions as readonly string[]).includes(NOTE),
        )
        .map((access) => access.role);
      expect(holders.length).toBeGreaterThan(0);
      expect(noteRule(await sampleOf("SUPPORT"))?.visibleTo).toEqual(holders);
    });

    it("hides the note from a role the matrix stops showing it to, with the reason", async () => {
      const change = await put("SYSTEM_ADMIN", noteCell("SUPPORT"), {
        granted: false,
      });
      expect(change.status).toBe(200);
      try {
        const body = await sampleOf("SUPPORT");
        expect(noteRule(body)?.visibleTo).not.toContain("SUPPORT");
        expect(body.data.records.length).toBeGreaterThan(0);
        for (const record of body.data.records) {
          expect(record.note).toMatchObject({
            masked: true,
            value: null,
            reason: "role",
          });
        }
      } finally {
        await put("SYSTEM_ADMIN", noteCell("SUPPORT"), { granted: true });
      }
    });

    it("shows the note to a role the matrix starts showing it to", async () => {
      const change = await put("SYSTEM_ADMIN", noteCell("WAREHOUSE"), {
        granted: true,
      });
      expect(change.status).toBe(200);
      try {
        const body = await sampleOf("WAREHOUSE");
        expect(noteRule(body)?.visibleTo).toContain("WAREHOUSE");
        expect(body.data.records[0]?.note.masked).toBe(false);
        expect(body.data.records[0]?.note.value).toBeTruthy();
      } finally {
        await put("SYSTEM_ADMIN", noteCell("WAREHOUSE"), { granted: false });
      }
    });
  });

  describe("what data may go to which AI provider", () => {
    const check = (body: object) =>
      post("SYSTEM_ADMIN", `${API}/governance/ai-destinations/check`, body);

    it("lists a rule for every provider, synthetic data only", async () => {
      const res = await call(
        t,
        as("AUDITOR"),
        "get",
        `${API}/governance/ai-destinations`,
      );
      expect(res.status).toBe(200);
      const rules = (res.body as { data: { origins: string[] }[] }).data;
      expect(rules).toHaveLength(3);
      for (const rule of rules) expect(rule.origins).toEqual(["synthetic"]);
    });

    it("allows synthetic data and refuses real data, with a reason", async () => {
      const allowed = await check({
        provider: "bedrock",
        classification: "restricted",
        origin: "synthetic",
      });
      expect(
        (allowed.body as { data: { allowed: boolean } }).data.allowed,
      ).toBe(true);
      const refused = await check({
        provider: "bedrock",
        classification: "internal",
        origin: "real",
      });
      expect(
        (refused.body as { data: { allowed: boolean; rule: string } }).data,
      ).toMatchObject({ allowed: false, rule: "synthetic-data-only" });
    });
  });

  describe("the seed and a permission revoked on purpose (F-8)", () => {
    /** Runs the real seed, as `pnpm db:seed` does, and returns its matrix line. */
    const seed = async () => {
      const lines: string[] = [];
      await runSeed(testConfig(), (line) => lines.push(line));
      return lines.find((line) => line.startsWith("seed role permissions:"));
    };
    const cell = (role: Role, permission: string) =>
      `${MATRIX}/${role}/permissions/${permission}`;
    /** Takes a pair out of the table without the matrix, as a story that adds a default finds it. */
    const removeQuietly = (role: Role, permission: Permission) =>
      t.app.get(RolePermissionRepository).revoke(role, permission);

    it("keeps a permission revoked on the matrix revoked through the next seed", async () => {
      const path = cell("WAREHOUSE", "exceptions.read");
      expect((await put("SYSTEM_ADMIN", path, { granted: false })).status).toBe(
        200,
      );
      try {
        await seed();
        expect((await access("WAREHOUSE")).permissions).not.toContain(
          "exceptions.read",
        );
      } finally {
        await put("SYSTEM_ADMIN", path, { granted: true });
      }
    });

    it("keeps what a copy took away revoked through the next seed", async () => {
      // Whatever Support holds that Warehouse does not: the copy takes it all.
      const source = new Set((await access("WAREHOUSE")).permissions);
      const taken = (await access("SUPPORT")).permissions.filter(
        (permission) => !source.has(permission),
      );
      expect(taken.length).toBeGreaterThan(0);
      const copy = await post("SYSTEM_ADMIN", `${MATRIX}/copy`, {
        fromRole: "WAREHOUSE",
        toRole: "SUPPORT",
      });
      expect(copy.status).toBe(200);
      try {
        await seed();
        const held: readonly string[] = (await access("SUPPORT")).permissions;
        for (const permission of taken) {
          expect(held, permission).not.toContain(permission);
        }
      } finally {
        for (const permission of taken) {
          await put("SYSTEM_ADMIN", cell("SUPPORT", permission), {
            granted: true,
          });
        }
      }
    });

    it("says in its log how many default pairs stay revoked, and counts no other pair", async () => {
      /** How many the seed's line says stay out: none when it says nothing. */
      const staysOut = (line: string | undefined) =>
        Number(
          /, and (\d+) revoked on purpose stays? out$/.exec(line ?? "")?.[1] ??
            0,
        );
      const before = staysOut(await seed());
      const path = cell("WAREHOUSE", "tracker.read");
      // Not a default for Warehouse, so the log must not count it.
      const other = cell("WAREHOUSE", "users.read");
      for (const granted of [true, false]) {
        expect((await put("SYSTEM_ADMIN", other, { granted })).status).toBe(
          200,
        );
      }
      expect((await put("SYSTEM_ADMIN", path, { granted: false })).status).toBe(
        200,
      );
      try {
        expect(staysOut(await seed())).toBe(before + 1);
      } finally {
        await put("SYSTEM_ADMIN", path, { granted: true });
      }
    });

    it("still adds a default pair that is missing with no revocation, as a new default would be", async () => {
      await removeQuietly("LOGISTICS", "tracker.read");
      await seed();
      expect((await access("LOGISTICS")).permissions).toContain("tracker.read");
    });

    it("forgets a revocation once the permission is granted again", async () => {
      const path = cell("FINANCE", "tracker.read");
      for (const granted of [false, true]) {
        expect((await put("SYSTEM_ADMIN", path, { granted })).status).toBe(200);
      }
      await removeQuietly("FINANCE", "tracker.read");
      await seed();
      expect((await access("FINANCE")).permissions).toContain("tracker.read");
    });

    it("forgets a revocation when a copy gives the permission back", async () => {
      const path = cell("WAREHOUSE", "exceptions.read");
      expect((await put("SYSTEM_ADMIN", path, { granted: false })).status).toBe(
        200,
      );
      const copy = await post("SYSTEM_ADMIN", `${MATRIX}/copy`, {
        fromRole: "SUPPORT",
        toRole: "WAREHOUSE",
      });
      expect(copy.status).toBe(200);
      await removeQuietly("WAREHOUSE", "exceptions.read");
      await seed();
      expect((await access("WAREHOUSE")).permissions).toContain(
        "exceptions.read",
      );
    });
  });
});
