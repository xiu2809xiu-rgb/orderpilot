import {
  auditChainCheckSchema,
  auditEventViewSchema,
  errorEnvelopeSchema,
  ROLES,
  type AuditEventView,
  type Role,
} from "@orderpilot/shared";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const EVENTS = `${API}/audit/events`;
const CHAIN = `${API}/audit/chain`;

describe("audit viewer: reading the trail over HTTP", () => {
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
  const list = async (role: Role, query = "") => {
    const res = await call(t, as(role), "get", `${EVENTS}${query}`);
    return {
      status: res.status,
      text: res.text,
      body: res.body as {
        data: AuditEventView[];
        meta: { page: number; pageSize: number; total: number };
      },
    };
  };

  describe("who may read", () => {
    it.each(["AUDITOR", "SYSTEM_ADMIN"] as const)(
      "lets %s read",
      async (role) => {
        const res = await list(role);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        for (const event of res.body.data) auditEventViewSchema.parse(event);
      },
    );

    it("refuses a role without audit.read, on the list, one event and the chain", async () => {
      const finance = as("FINANCE");
      for (const path of [
        EVENTS,
        `${EVENTS}/00000000-0000-4000-8000-000000000000`,
        CHAIN,
      ]) {
        const res = await call(t, finance, "get", path);
        expect(res.status).toBe(403);
        errorEnvelopeSchema.parse(res.body);
      }
    });

    it("refuses a caller who is not signed in", async () => {
      const res = await call(t, null, "get", EVENTS);
      expect(res.status).toBe(401);
    });

    it("offers no route that writes, edits or deletes an event", async () => {
      const auditor = as("AUDITOR");
      const server = t.app.getHttpServer();
      expect(
        (await call(t, auditor, "post", EVENTS, { csrf: true, body: {} }))
          .status,
      ).toBe(404);
      expect(
        (await call(t, auditor, "put", `${EVENTS}/x`, { csrf: true, body: {} }))
          .status,
      ).toBe(404);
      const del = await request(server)
        .delete(EVENTS)
        .set("Cookie", auditor.cookieHeader(EVENTS))
        .set("X-CSRF-Token", auditor.csrf);
      expect(del.status).toBe(404);
    });
  });

  describe("paging and filters", () => {
    it("pages the trail newest first, with a total", async () => {
      const first = await list("AUDITOR", "?pageSize=2");
      expect(first.body.data).toHaveLength(2);
      expect(first.body.meta).toMatchObject({ page: 1, pageSize: 2 });
      expect(first.body.meta.total).toBeGreaterThan(2);
      const [a, b] = first.body.data;
      expect(a?.sequence).toBeGreaterThan(b?.sequence ?? Infinity);
      const second = await list("AUDITOR", "?pageSize=2&page=2");
      expect(second.body.data[0]?.sequence).toBeLessThan(b?.sequence ?? 0);
    });

    it("keeps refusals only, and a refusal is marked", async () => {
      await call(t, as("FINANCE"), "get", EVENTS);
      const res = await list("AUDITOR", "?refusalsOnly=true&pageSize=200");
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((e) => e.refusal)).toBe(true);
      const all = await list("AUDITOR", "?refusalsOnly=false&pageSize=200");
      expect(all.body.data.some((e) => !e.refusal)).toBe(true);
    });

    it("filters by actor, role, action, entity, and words in the summary", async () => {
      const refused = await list("AUDITOR", "?action=auth.permission.refused");
      const event = refused.body.data[0];
      if (!event) throw new Error("no refusal to filter by");
      expect(event.actorRole).toBe("FINANCE");

      const byRole = await list("AUDITOR", "?role=FINANCE&pageSize=200");
      expect(byRole.body.data.every((e) => e.actorRole === "FINANCE")).toBe(
        true,
      );
      expect(byRole.body.data.length).toBeGreaterThan(0);

      const byActor = await list(
        "AUDITOR",
        `?actorUserId=${event.actorUserId ?? ""}&pageSize=200`,
      );
      expect(
        byActor.body.data.every((e) => e.actorUserId === event.actorUserId),
      ).toBe(true);

      const byEntity = await list(
        "AUDITOR",
        `?entityType=${event.entityType}&entityId=${encodeURIComponent(event.entityId)}`,
      );
      expect(byEntity.body.data.map((e) => e.id)).toContain(event.id);

      const bySystem = await list("AUDITOR", "?actorKind=system&pageSize=200");
      expect(bySystem.body.data.every((e) => e.actorKind === "system")).toBe(
        true,
      );

      const bySummary = await list("AUDITOR", "?search=WAS%20REFUSED");
      expect(bySummary.body.data.map((e) => e.id)).toContain(event.id);

      const none = await list("AUDITOR", "?action=no.such.action");
      expect(none.body.data).toEqual([]);
      expect(none.body.meta.total).toBe(0);
    });

    it("filters by an inclusive time range", async () => {
      const all = await list("AUDITOR", "?pageSize=200");
      const newest = all.body.data[0];
      if (!newest) throw new Error("empty trail");
      const at = encodeURIComponent(newest.occurredAt);
      const exact = await list("AUDITOR", `?from=${at}&to=${at}&pageSize=200`);
      expect(exact.body.data.map((e) => e.id)).toContain(newest.id);
      const future = await list("AUDITOR", "?from=2999-01-01T00:00:00.000Z");
      expect(future.body.meta.total).toBe(0);
    });

    it("rejects a filter that does not validate", async () => {
      for (const query of [
        "?actorUserId=not-a-uuid",
        "?role=KING",
        "?refusalsOnly=maybe",
        "?from=yesterday",
        "?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z",
        "?pageSize=5000",
      ]) {
        const res = await list("AUDITOR", query);
        expect(res.status, query).toBe(400);
      }
    });
  });

  describe("one event", () => {
    it("returns it, and 404 for an id that does not exist", async () => {
      const first = (await list("AUDITOR")).body.data[0];
      if (!first) throw new Error("empty trail");
      const res = await call(t, as("AUDITOR"), "get", `${EVENTS}/${first.id}`);
      expect(res.status).toBe(200);
      expect(
        auditEventViewSchema.parse((res.body as { data: unknown }).data).id,
      ).toBe(first.id);
      const missing = await call(
        t,
        as("AUDITOR"),
        "get",
        `${EVENTS}/00000000-0000-4000-8000-000000000000`,
      );
      expect(missing.status).toBe(404);
      const bad = await call(t, as("AUDITOR"), "get", `${EVENTS}/nope`);
      expect(bad.status).toBe(400);
    });
  });

  describe("masking of an event's changes", () => {
    const secret = async (role: Role) => {
      const res = await list(
        role,
        "?action=auth.permission.refused&pageSize=200",
      );
      const withReason = res.body.data.find((e) =>
        e.changes.some((c) => c.field === "reason"),
      );
      return {
        res,
        change: withReason?.changes.find((c) => c.field === "reason"),
      };
    };

    it("shows the sample rule's field to an auditor", async () => {
      const { change } = await secret("AUDITOR");
      expect(change?.masked).toBe(false);
      expect(change?.after).toBeTruthy();
    });

    it("hides it from the system admin, with a reason, and the value is not in the body", async () => {
      const { res, change } = await secret("SYSTEM_ADMIN");
      expect(change).toMatchObject({
        masked: true,
        reason: "policy",
        before: null,
        after: null,
      });
      const auditorValue = (await secret("AUDITOR")).change?.after ?? "";
      expect(auditorValue.length).toBeGreaterThan(0);
      expect(res.text).not.toContain(`"${auditorValue}"`);
    });

    it("masks one event the same way", async () => {
      const { res } = await secret("SYSTEM_ADMIN");
      const id = res.body.data.find((e) => e.changes.some((c) => c.masked))?.id;
      const one = await call(
        t,
        as("SYSTEM_ADMIN"),
        "get",
        `${EVENTS}/${id ?? ""}`,
      );
      expect(one.status).toBe(200);
      const view = auditEventViewSchema.parse(
        (one.body as { data: unknown }).data,
      );
      expect(
        view.changes.filter((c) => c.masked).every((c) => c.after === null),
      ).toBe(true);
    });
  });

  describe("the chain check", () => {
    it("says verified up to the newest sequence", async () => {
      const newest = (await list("AUDITOR")).body.data[0];
      const res = await call(t, as("AUDITOR"), "get", CHAIN);
      expect(res.status).toBe(200);
      const check = auditChainCheckSchema.parse(
        (res.body as { data: unknown }).data,
      );
      expect(check).toMatchObject({
        ok: true,
        brokenAtSequence: null,
        problem: null,
      });
      expect(check.checked).toBeGreaterThan(0);
      expect(check.verifiedThrough).toBeGreaterThanOrEqual(
        newest?.sequence ?? 0,
      );
    });

    it("names the sequence where the chain breaks after tampering", async () => {
      const victim = (await list("AUDITOR", "?pageSize=200")).body.data.at(-1);
      if (!victim) throw new Error("empty trail");
      const client = new pg.Client({
        connectionString: testConfig().database.url,
      });
      await client.connect();
      try {
        await client.query("BEGIN");
        await client.query('ALTER TABLE "AuditEvent" DISABLE TRIGGER USER');
        await client.query(
          `UPDATE "AuditEvent" SET summary = 'Rewritten' WHERE id = $1`,
          [victim.id],
        );
        await client.query('ALTER TABLE "AuditEvent" ENABLE TRIGGER USER');
        await client.query("COMMIT");
      } finally {
        await client.end();
      }
      const res = await call(t, as("AUDITOR"), "get", CHAIN);
      const check = auditChainCheckSchema.parse(
        (res.body as { data: unknown }).data,
      );
      expect(check).toMatchObject({
        ok: false,
        brokenAtSequence: victim.sequence,
        brokenAtEventId: victim.id,
        problem: "hash-mismatch",
      });
      expect(check.verifiedThrough).toBeLessThan(victim.sequence);
    });
  });
});
