import {
  ROLES,
  errorEnvelopeSchema,
  sparkConversationDetailResponseSchema,
  sparkConversationListResponseSchema,
  sparkConversationResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
  passwordSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const CONVERSATIONS = `${API}/spark/conversations`;
const UNKNOWN_ID = "0192f3c4-7b1e-7c3a-9d2f-5a6b7c8d9e0f";

const ASKERS = ROLES.filter((role) => role !== "SYSTEM_ADMIN");

let counter = 0;
const nextId = (label: string): string =>
  `spark-http-${label}-${String(++counter)}`;

function codeOf(body: unknown): string {
  return errorEnvelopeSchema.parse(body).error.code;
}

/** The error envelope with the one part that differs between two requests removed. */
function withoutTrace(body: unknown): unknown {
  const { error } = errorEnvelopeSchema.parse(body);
  return { error: { ...error, traceId: "-" } };
}

async function create(
  t: TestApp,
  browser: Browser,
  body: object = {},
): Promise<string> {
  const res = await call(t, browser, "post", CONVERSATIONS, {
    csrf: true,
    body,
  });
  expect(res.status, res.text).toBe(201);
  return sparkConversationResponseSchema.parse(res.body).data.id;
}

describe("Spark's conversation routes over HTTP", () => {
  let t: TestApp;
  const as = new Map<Role, Browser>();
  const browser = (role: Role): Browser => {
    const found = as.get(role);
    if (!found) throw new Error(`no session for ${role}`);
    return found;
  };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ SPARK_QUESTIONS_PER_MINUTE: "1000" });
    for (const role of ROLES) as.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  describe("without a session", () => {
    it("is 401 on every route", async () => {
      const routes = [
        ["get", CONVERSATIONS],
        ["post", CONVERSATIONS],
        ["get", `${CONVERSATIONS}/${UNKNOWN_ID}`],
        ["delete", `${CONVERSATIONS}/${UNKNOWN_ID}`],
        ["post", `${CONVERSATIONS}/${UNKNOWN_ID}/messages`],
      ] as const;
      for (const [method, path] of routes) {
        const res = await call(t, null, method, path, {
          body: { question: "Hello" },
        });
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(codeOf(res.body)).toBe("UNAUTHENTICATED");
      }
    });
  });

  describe("without a CSRF token", () => {
    it("refuses a post and a delete, and stores nothing", async () => {
      const id = await create(t, browser("SUPPORT"));
      for (const [method, path] of [
        ["post", CONVERSATIONS],
        ["post", `${CONVERSATIONS}/${id}/messages`],
        ["delete", `${CONVERSATIONS}/${id}`],
      ] as const) {
        const res = await call(t, browser("SUPPORT"), method, path, {
          body: { question: "Hello" },
        });
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(codeOf(res.body)).toBe("CSRF_INVALID");
      }
      const detail = await call(
        t,
        browser("SUPPORT"),
        "get",
        `${CONVERSATIONS}/${id}`,
      );
      expect(
        sparkConversationDetailResponseSchema.parse(detail.body).data.messages,
      ).toHaveLength(0);
    });
  });

  describe("the spark.use permission", () => {
    it("is 403 for the System admin on every route, audited with the permission, and no model is asked", async () => {
      const admin = browser("SYSTEM_ADMIN");
      for (const [method, path] of [
        ["get", CONVERSATIONS],
        ["post", CONVERSATIONS],
        ["get", `${CONVERSATIONS}/${UNKNOWN_ID}`],
        ["delete", `${CONVERSATIONS}/${UNKNOWN_ID}`],
        ["post", `${CONVERSATIONS}/${UNKNOWN_ID}/messages`],
      ] as const) {
        const requestId = nextId("admin");
        const res = await call(t, admin, method, path, {
          csrf: true,
          body: { question: "Hello" },
        }).set("X-Request-Id", requestId);
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(codeOf(res.body)).toBe("FORBIDDEN");
        const refusals = (await auditEvents(t)).filter(
          (e) =>
            e.action === "auth.permission.refused" && e.traceId === requestId,
        );
        expect(refusals, `${method} ${path}`).toHaveLength(1);
        expect(refusals[0]?.changes).toMatchObject({ permission: "spark.use" });
        expect(refusals[0]?.summary).toContain("asking Spark");
      }
      const usage = await t.app
        .get(Database)
        .client.aiUsageRecord.count({ where: { feature: "spark" } });
      expect(usage).toBe(0);
    });

    it("is held by the eight other roles, who can each start and list a conversation", async () => {
      expect(ASKERS).toHaveLength(8);
      for (const role of ASKERS) {
        const id = await create(t, browser(role));
        const list = await call(t, browser(role), "get", CONVERSATIONS);
        expect(list.status, role).toBe(200);
        const ids = sparkConversationListResponseSchema
          .parse(list.body)
          .data.map((c) => c.id);
        expect(ids, role).toContain(id);
      }
    });
  });

  describe("validation", () => {
    let id: string;
    beforeAll(async () => {
      id = await create(t, browser("PRODUCT_MANAGER"));
    });

    it("is 400 for a question that is empty, blank, too long, not text or carries another field, and stores nothing", async () => {
      for (const body of [
        {},
        { question: "" },
        { question: "   " },
        { question: "x".repeat(2001) },
        { question: 42 },
        { question: "Hello", model: "gpt-x" },
        { question: "Hello", conversationId: UNKNOWN_ID },
      ]) {
        const res = await call(
          t,
          browser("PRODUCT_MANAGER"),
          "post",
          `${CONVERSATIONS}/${id}/messages`,
          { csrf: true, body },
        );
        expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
      const detail = await call(
        t,
        browser("PRODUCT_MANAGER"),
        "get",
        `${CONVERSATIONS}/${id}`,
      );
      expect(
        sparkConversationDetailResponseSchema.parse(detail.body).data.messages,
      ).toHaveLength(0);
    });

    it("takes a question of exactly 2000 characters", async () => {
      const res = await call(
        t,
        browser("PRODUCT_MANAGER"),
        "post",
        `${CONVERSATIONS}/${id}/messages`,
        { csrf: true, body: { question: "x".repeat(2000) } },
      );
      expect(res.status, res.text).toBe(201);
    });

    it("is 400 for a conversation that carries another field or a title that is too long", async () => {
      for (const body of [
        { title: "x".repeat(121) },
        { title: "" },
        { userId: UNKNOWN_ID },
      ]) {
        const res = await call(
          t,
          browser("PRODUCT_MANAGER"),
          "post",
          CONVERSATIONS,
          {
            csrf: true,
            body,
          },
        );
        expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      }
    });

    it("is 400 for an id that is not an id, and for a page that is not a page", async () => {
      for (const [method, path] of [
        ["get", `${CONVERSATIONS}/not-an-id`],
        ["delete", `${CONVERSATIONS}/not-an-id`],
        ["post", `${CONVERSATIONS}/not-an-id/messages`],
        ["get", `${CONVERSATIONS}?page=0`],
        ["get", `${CONVERSATIONS}?pageSize=201`],
        ["get", `${CONVERSATIONS}?page=abc`],
      ] as const) {
        const res = await call(t, browser("PRODUCT_MANAGER"), method, path, {
          csrf: true,
          body: { question: "Hello" },
        });
        expect(res.status, `${method} ${path}`).toBe(400);
        expect(codeOf(res.body)).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("ownership", () => {
    it("answers an unknown id and another person's conversation with the same 404", async () => {
      const mine = await create(t, browser("FINANCE"), { title: "Mine" });
      const theirs = browser("LOGISTICS");
      for (const [method, suffix] of [
        ["get", ""],
        ["delete", ""],
        ["post", "/messages"],
      ] as const) {
        const other = await call(
          t,
          theirs,
          method,
          `${CONVERSATIONS}/${mine}${suffix}`,
          { csrf: true, body: { question: "Hello" } },
        );
        const unknown = await call(
          t,
          theirs,
          method,
          `${CONVERSATIONS}/${UNKNOWN_ID}${suffix}`,
          { csrf: true, body: { question: "Hello" } },
        );
        expect(other.status, method).toBe(404);
        expect(unknown.status, method).toBe(404);
        expect(withoutTrace(other.body), method).toEqual(
          withoutTrace(unknown.body),
        );
        expect(codeOf(other.body)).toBe("NOT_FOUND");
      }
      // The owner still has it, untouched by the other person's attempts.
      const still = await call(
        t,
        browser("FINANCE"),
        "get",
        `${CONVERSATIONS}/${mine}`,
      );
      expect(still.status).toBe(200);
      expect(
        sparkConversationDetailResponseSchema.parse(still.body).data
          .conversation.title,
      ).toBe("Mine");
    });

    it("lists only the caller's own conversations", async () => {
      const a = await create(t, browser("WAREHOUSE"));
      const b = await create(t, browser("AUDITOR"));
      const ids = async (role: Role): Promise<string[]> =>
        sparkConversationListResponseSchema
          .parse(
            (
              await call(
                t,
                browser(role),
                "get",
                `${CONVERSATIONS}?pageSize=200`,
              )
            ).body,
          )
          .data.map((c) => c.id);
      expect(await ids("WAREHOUSE")).toContain(a);
      expect(await ids("WAREHOUSE")).not.toContain(b);
      expect(await ids("AUDITOR")).toContain(b);
      expect(await ids("AUDITOR")).not.toContain(a);
    });
  });

  describe("the list", () => {
    it("pages by page and pageSize, newest first, with the total", async () => {
      const lister = await demoSignIn(t, "MANAGEMENT");
      const made: string[] = [];
      for (let i = 1; i <= 5; i += 1) {
        made.push(await create(t, lister, { title: `Thread ${String(i)}` }));
      }
      const first = sparkConversationListResponseSchema.parse(
        (await call(t, lister, "get", `${CONVERSATIONS}?page=1&pageSize=2`))
          .body,
      );
      expect(first.meta).toEqual({ page: 1, pageSize: 2, total: 5 });
      expect(first.data.map((c) => c.title)).toEqual(["Thread 5", "Thread 4"]);
      const last = sparkConversationListResponseSchema.parse(
        (await call(t, lister, "get", `${CONVERSATIONS}?page=3&pageSize=2`))
          .body,
      );
      expect(last.data.map((c) => c.title)).toEqual(["Thread 1"]);
      expect(made).toHaveLength(5);
    });

    it("moves a conversation to the top when a question is asked in it", async () => {
      const lister = await demoSignIn(t, "APPROVER");
      const older = await create(t, lister, { title: "Older" });
      await create(t, lister, { title: "Newer" });
      await call(t, lister, "post", `${CONVERSATIONS}/${older}/messages`, {
        csrf: true,
        body: { question: "Hello" },
      });
      const list = sparkConversationListResponseSchema.parse(
        (await call(t, lister, "get", CONVERSATIONS)).body,
      );
      expect(list.data.map((c) => c.title)).toEqual(["Older", "Newer"]);
      expect(list.data[0]?.messageCount).toBe(2);
    });
  });

  describe("archiving", () => {
    it("keeps the conversation, hides it everywhere, and audits it", async () => {
      const owner = await demoSignIn(t, "SUPPORT");
      const id = await create(t, owner);
      const requestId = nextId("archive");
      const res = await call(t, owner, "delete", `${CONVERSATIONS}/${id}`, {
        csrf: true,
      }).set("X-Request-Id", requestId);
      expect(res.status).toBe(204);

      const ids = sparkConversationListResponseSchema
        .parse(
          (await call(t, owner, "get", `${CONVERSATIONS}?pageSize=200`)).body,
        )
        .data.map((c) => c.id);
      expect(ids).not.toContain(id);
      for (const [method, path] of [
        ["get", `${CONVERSATIONS}/${id}`],
        ["delete", `${CONVERSATIONS}/${id}`],
        ["post", `${CONVERSATIONS}/${id}/messages`],
      ] as const) {
        const again = await call(t, owner, method, path, {
          csrf: true,
          body: { question: "Hello" },
        });
        expect(again.status, `${method} ${path}`).toBe(404);
      }

      const row = await t.app
        .get(Database)
        .client.sparkConversation.findUnique({ where: { id } });
      expect(row?.archivedAt).not.toBeNull();
      const events = (await auditEvents(t)).filter(
        (e) =>
          e.action === "spark.conversation.archived" && e.traceId === requestId,
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.entityId).toBe(id);
    });
  });

  describe("a demo session", () => {
    it("keeps conversations per session: a second sign-in of the same role reads none of the first's", async () => {
      const first = await demoSignIn(t, "PRODUCT_MANAGER");
      const second = await demoSignIn(t, "PRODUCT_MANAGER");
      // The same seeded user, two sign-ins.
      expect(second.session.user.id).toBe(first.session.user.id);
      expect(first.session.demo).toBe(true);

      const id = await create(t, first, { title: "First tester" });
      await call(t, first, "post", `${CONVERSATIONS}/${id}/messages`, {
        csrf: true,
        body: { question: "A private question" },
      });

      const list = await call(
        t,
        second,
        "get",
        `${CONVERSATIONS}?pageSize=200`,
      );
      expect(
        sparkConversationListResponseSchema
          .parse(list.body)
          .data.map((c) => c.id),
      ).not.toContain(id);
      for (const [method, path] of [
        ["get", `${CONVERSATIONS}/${id}`],
        ["delete", `${CONVERSATIONS}/${id}`],
        ["post", `${CONVERSATIONS}/${id}/messages`],
      ] as const) {
        const res = await call(t, second, method, path, {
          csrf: true,
          body: { question: "Let me in" },
        });
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(res.text).not.toContain("private question");
      }
      // The first tester still has theirs, with nothing added by the second.
      const mine = sparkConversationDetailResponseSchema.parse(
        (await call(t, first, "get", `${CONVERSATIONS}/${id}`)).body,
      ).data;
      expect(mine.messages).toHaveLength(2);
    });
  });
});

describe("a real sign-in keeps a person's conversations across their sessions", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ SPARK_QUESTIONS_PER_MINUTE: "1000" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("shows them to the same person in a second session, and to nobody else", async () => {
    const support = await emailForRole("SUPPORT");
    const first = await passwordSignIn(t, support);
    const second = await passwordSignIn(t, support);
    expect(first.session.demo).toBe(false);
    const id = await create(t, first, { title: "Kept" });

    const seen = await call(t, second, "get", `${CONVERSATIONS}/${id}`);
    expect(seen.status).toBe(200);

    const other = await passwordSignIn(t, await emailForRole("FINANCE"));
    expect((await call(t, other, "get", `${CONVERSATIONS}/${id}`)).status).toBe(
      404,
    );
  });
});
