import {
  auditChainCheckSchema,
  auditEventViewSchema,
  auditFilterOptionsSchema,
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
const OPTIONS = `${API}/audit/filter-options`;

/**
 * F-9: the people and actions the filters offer, the events around a
 * sequence, and where a broken chain breaks. A file of its own, so its
 * tampering starts from an intact chain. Rows are changed only here, in the
 * test database, never through a route.
 */
describe("audit viewer polish (F-9)", () => {
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
  const list = async (query: string) => {
    const res = await call(t, as("AUDITOR"), "get", `${EVENTS}${query}`);
    return {
      status: res.status,
      body: res.body as {
        data: AuditEventView[];
        meta: { total: number };
      },
    };
  };
  /** Every event in the trail, newest first. */
  const everything = async (): Promise<AuditEventView[]> => {
    const out: AuditEventView[] = [];
    for (let page = 1; ; page += 1) {
      const res = await list(`?pageSize=200&page=${String(page)}`);
      out.push(...res.body.data);
      if (out.length >= res.body.meta.total || res.body.data.length === 0) {
        return out;
      }
    }
  };
  const options = async (role: Role) => {
    const res = await call(t, as(role), "get", OPTIONS);
    return { status: res.status, text: res.text, body: res.body as unknown };
  };

  describe("the people and actions the filters offer", () => {
    it.each(["AUDITOR", "SYSTEM_ADMIN"] as const)(
      "lets %s read them",
      async (role) => {
        const res = await options(role);
        expect(res.status).toBe(200);
        const { data } = res.body as { data: unknown };
        const parsed = auditFilterOptionsSchema.parse(data);
        expect(parsed.people.length).toBeGreaterThan(0);
        expect(parsed.actions.length).toBeGreaterThan(0);
      },
    );

    it("refuses a role without audit.read, and the refusal is audited", async () => {
      const res = await options("FINANCE");
      expect(res.status).toBe(403);
      errorEnvelopeSchema.parse(res.body);
      const refused = await list(
        `?action=auth.permission.refused&role=FINANCE&entityId=${encodeURIComponent("GET /api/v1/audit/filter-options")}`,
      );
      expect(refused.body.data.length).toBeGreaterThan(0);
    });

    it("refuses a caller who is not signed in", async () => {
      const res = await call(t, null, "get", OPTIONS);
      expect(res.status).toBe(401);
    });

    it("offers no route that writes to it", async () => {
      const auditor = as("AUDITOR");
      for (const method of ["post", "put", "patch"] as const) {
        const res = await call(t, auditor, method, OPTIONS, {
          csrf: true,
          body: {},
        });
        expect(res.status, method).toBe(404);
      }
      const del = await request(t.app.getHttpServer())
        .delete(OPTIONS)
        .set("Cookie", auditor.cookieHeader(OPTIONS))
        .set("X-CSRF-Token", auditor.csrf);
      expect(del.status).toBe(404);
    });

    it("offers exactly the people who appear in the trail, by name, never by email", async () => {
      const res = await options("AUDITOR");
      const { people } = auditFilterOptionsSchema.parse(
        (res.body as { data: unknown }).data,
      );
      const trail = await everything();
      const actors = new Map<string, string>();
      for (const event of trail) {
        if (event.actorUserId) actors.set(event.actorUserId, event.actorName);
      }
      expect(new Set(people.map((p) => p.id))).toEqual(new Set(actors.keys()));
      expect(people).toHaveLength(actors.size);
      for (const person of people) {
        expect(person.name).toBe(actors.get(person.id));
        expect(Object.keys(person).sort()).toEqual(["id", "name"]);
      }
      expect(res.text).not.toContain("@");
    });

    it("sorts the people by name", async () => {
      const { people } = auditFilterOptionsSchema.parse(
        ((await options("AUDITOR")).body as { data: unknown }).data,
      );
      const names = people.map((p) => p.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it("offers exactly the action names in the trail, each once, in order", async () => {
      const { actions } = auditFilterOptionsSchema.parse(
        ((await options("AUDITOR")).body as { data: unknown }).data,
      );
      const trail = await everything();
      const expected = [...new Set(trail.map((e) => e.action))].sort();
      expect(actions).toEqual(expected);
    });

    it("offers a person and an action as soon as the trail has them", async () => {
      await call(t, as("WAREHOUSE"), "get", EVENTS);
      const { people, actions } = auditFilterOptionsSchema.parse(
        ((await options("AUDITOR")).body as { data: unknown }).data,
      );
      const warehouse = (await list("?role=WAREHOUSE&pageSize=1")).body.data[0];
      expect(people.map((p) => p.id)).toContain(warehouse?.actorUserId);
      expect(actions).toContain("auth.permission.refused");
    });
  });

  describe("the events around a sequence", () => {
    /** A sequence with at least five events on each side. */
    const middle = async (): Promise<number> => {
      const trail = await everything();
      expect(trail.length).toBeGreaterThanOrEqual(11);
      const event = trail[Math.floor(trail.length / 2)];
      if (!event) throw new Error("empty trail");
      return event.sequence;
    };

    it("returns the events five sequences either side, newest first", async () => {
      const at = await middle();
      const res = await list(`?around=${String(at)}&pageSize=200`);
      expect(res.status).toBe(200);
      const sequences = res.body.data.map((e) => e.sequence);
      expect(sequences).toContain(at);
      expect(sequences).toEqual([...sequences].sort((a, b) => b - a));
      const trail = (await everything())
        .map((e) => e.sequence)
        .filter((s) => s >= at - 5 && s <= at + 5);
      expect(sequences).toEqual(trail);
    });

    it("starts at the first event when the sequence is near the start", async () => {
      const oldest = (await everything()).at(-1);
      if (!oldest) throw new Error("empty trail");
      const res = await list(`?around=${String(oldest.sequence)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.at(-1)?.sequence).toBe(oldest.sequence);
      expect(
        res.body.data.every((e) => e.sequence <= oldest.sequence + 5),
      ).toBe(true);
    });

    it("combines with the other filters", async () => {
      const at = await middle();
      const res = await list(
        `?around=${String(at)}&actorKind=user&pageSize=200`,
      );
      expect(res.status).toBe(200);
      for (const event of res.body.data) {
        expect(event.actorKind).toBe("user");
        expect(Math.abs(event.sequence - at)).toBeLessThanOrEqual(5);
      }
    });

    it("rejects a sequence that is not a positive whole number", async () => {
      for (const around of ["0", "-1", "1.5", "abc"]) {
        const res = await list(`?around=${around}`);
        expect(res.status, around).toBe(400);
      }
    });
  });

  describe("a broken chain", () => {
    /** Rewrites one event's summary in the test database, past the trigger. */
    const tamper = async (id: string) => {
      const client = new pg.Client({
        connectionString: testConfig().database.url,
      });
      await client.connect();
      try {
        await client.query("BEGIN");
        await client.query('ALTER TABLE "AuditEvent" DISABLE TRIGGER USER');
        await client.query(
          `UPDATE "AuditEvent" SET summary = 'Rewritten by the F-9 test' WHERE id = $1`,
          [id],
        );
        await client.query('ALTER TABLE "AuditEvent" ENABLE TRIGGER USER');
        await client.query("COMMIT");
      } finally {
        await client.end();
      }
    };
    let victim: AuditEventView;

    beforeAll(async () => {
      const trail = await everything();
      const chosen = trail[Math.floor(trail.length / 2)];
      if (!chosen) throw new Error("empty trail");
      victim = chosen;
      await tamper(victim.id);
    });

    it("points at the event it breaks at, which opens", async () => {
      const res = await call(t, as("AUDITOR"), "get", CHAIN);
      const check = auditChainCheckSchema.parse(
        (res.body as { data: unknown }).data,
      );
      expect(check).toMatchObject({
        ok: false,
        brokenAtSequence: victim.sequence,
        brokenAtEventId: victim.id,
      });
      const one = await call(
        t,
        as("AUDITOR"),
        "get",
        `${EVENTS}/${check.brokenAtEventId ?? ""}`,
      );
      expect(one.status).toBe(200);
      const view = auditEventViewSchema.parse(
        (one.body as { data: unknown }).data,
      );
      expect(view.summary).toBe("Rewritten by the F-9 test");
    });

    it("shows the events around it, the broken one among them", async () => {
      const res = await list(`?around=${String(victim.sequence)}`);
      const sequences = res.body.data.map((e) => e.sequence);
      expect(sequences).toContain(victim.sequence);
      expect(sequences.some((s) => s < victim.sequence)).toBe(true);
      expect(sequences.some((s) => s > victim.sequence)).toBe(true);
      expect(
        sequences.every((s) => Math.abs(s - victim.sequence) <= 5),
        sequences.join(),
      ).toBe(true);
    });
  });
});
