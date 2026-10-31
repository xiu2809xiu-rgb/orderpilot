import {
  aiUsageReportSchema,
  clickstreamSummarySchema,
  observabilityReportSchema,
  type Role,
} from "@orderpilot/shared";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { AppConfig } from "../../src/config/app-config.js";
import {
  initTelemetry,
  type Telemetry,
} from "../../src/telemetry/telemetry.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, testEnv, type TestApp } from "../support/test-app.js";

const TOKEN = "integration-test-metrics-token-0001";
const CLICKS = `${API}/analytics/clickstream`;
const AT = new Date().toISOString();
const click = { name: "page_view", route: "/orders/:id", at: AT };

describe("monitoring over HTTP", () => {
  let t: TestApp;
  let telemetry: Telemetry;
  const spans = new InMemorySpanExporter();
  const sessions = new Map<Role, Browser>();
  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };

  beforeAll(async () => {
    await resetTestData();
    telemetry = initTelemetry(AppConfig.fromEnv(testEnv()), {
      extraSpanProcessors: [new SimpleSpanProcessor({ exporter: spans })],
    });
    t = await createTestApp({ METRICS_TOKEN: TOKEN });
    for (const role of ["APPROVER", "MANAGEMENT", "WAREHOUSE"] as const) {
      sessions.set(role, await demoSignIn(t, role));
    }
  });
  afterAll(async () => {
    await t.close();
    await telemetry.shutdown();
  });

  describe("traces", () => {
    it("records a span per request, named by route pattern, with the request id", async () => {
      await request(t.app.getHttpServer())
        .get("/api/v1/system/checks")
        .set("X-Request-Id", "trace-one-1");
      const span = spans
        .getFinishedSpans()
        .find((s) => s.attributes["orderpilot.request_id"] === "trace-one-1");
      expect(span?.name).toBe("GET /api/v1/system/checks");
      expect(span?.attributes["http.route"]).toBe("/api/v1/system/checks");
      expect(span?.attributes["http.response.status_code"]).toBe(200);
      expect(span?.resource.attributes["service.name"]).toBe("orderpilot-api");
    });

    it("puts the trace id in the log line that carries the request id", async () => {
      await request(t.app.getHttpServer())
        .get("/api/v1/system/checks")
        .set("X-Request-Id", "trace-two-1");
      const span = spans
        .getFinishedSpans()
        .find((s) => s.attributes["orderpilot.request_id"] === "trace-two-1");
      const line = t.logLines().find((l) => l.requestId === "trace-two-1");
      expect(span).toBeDefined();
      expect(line?.traceId).toBe(span?.spanContext().traceId);
    });

    it("does not export anything when no collector address is set", () => {
      expect(telemetry.exporting).toBe(false);
    });
  });

  describe("GET /metrics", () => {
    const scrape = (token?: string) => {
      const req = request(t.app.getHttpServer()).get("/metrics");
      return token === undefined
        ? req
        : req.set("Authorization", `Bearer ${token}`);
    };

    it("refuses a call with no token or the wrong one", async () => {
      expect((await scrape()).status).toBe(401);
      expect((await scrape("wrong-token-of-some-length-0001")).status).toBe(
        401,
      );
    });

    it("answers the right token with Prometheus text: default metrics and the request histogram by route pattern", async () => {
      await request(t.app.getHttpServer()).get("/api/v1/nope/0190a1b2-0000");
      const res = await scrape(TOKEN);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("orderpilot_process_cpu_user_seconds_total");
      expect(res.text).toMatch(
        /orderpilot_http_request_duration_seconds_bucket\{[^}]*route="\/api\/v1\/system\/checks"/,
      );
      // An unmatched path is one label, never the raw URL.
      expect(res.text).toContain('route="unmatched"');
      expect(res.text).not.toContain("0190a1b2");
    });

    it("does not exist when no token is configured", async () => {
      const bare = await createTestApp();
      try {
        const res = await request(bare.app.getHttpServer())
          .get("/metrics")
          .set("Authorization", `Bearer ${TOKEN}`);
        expect(res.status).toBe(404);
      } finally {
        await bare.close();
      }
    });
  });

  describe("GET /monitoring/ai-usage", () => {
    const get = (role: Role, query = "") =>
      call(t, as(role), "get", `${API}/monitoring/ai-usage${query}`);

    it("is an honest empty report before the gateway writes anything", async () => {
      const res = await get("MANAGEMENT");
      expect(res.status).toBe(200);
      const report = aiUsageReportSchema.parse(res.body);
      expect(report.data.records).toEqual([]);
      expect(report.data.byFeature).toEqual([]);
      expect(report.data.summary).toMatchObject({ calls: 0, failedCalls: 0 });
      expect(report.meta.total).toBe(0);
      expect(res.body).not.toHaveProperty("meta.mock");
    });

    it("sums the real records, newest first, with cost to four places", async () => {
      const client = t.app.get(Database).client;
      const row = (
        feature: string,
        cost: string,
        status: string,
        minute: number,
      ) => ({
        occurredAt: new Date(Date.UTC(2026, 10, 1, 8, minute)),
        feature,
        provider: "mock",
        model: "mock-1",
        promptVersion: "v1",
        inputTokens: 1000,
        outputTokens: 200,
        costUsd: cost,
        latencyMs: 350,
        status,
        traceId: "ai-trace-" + String(minute),
      });
      await client.aiUsageRecord.createMany({
        data: [
          row("document-extraction", "0.0120", "ok", 1),
          row("document-extraction", "0.0310", "ok", 2),
          row("exception-triage", "0.0055", "error", 3),
        ],
      });
      const res = await get("MANAGEMENT", "?pageSize=2");
      const report = aiUsageReportSchema.parse(res.body);
      expect(report.data.summary).toEqual({
        calls: 3,
        inputTokens: 3000,
        outputTokens: 600,
        costUsd: "0.0485",
        failedCalls: 1,
      });
      expect(report.data.byFeature[0]).toEqual({
        feature: "document-extraction",
        calls: 2,
        costUsd: "0.0430",
      });
      expect(report.data.records.map((r) => r.traceId)).toEqual([
        "ai-trace-3",
        "ai-trace-2",
      ]);
      expect(report.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
    });

    it("refuses a role without aiUsage.read", async () => {
      const res = await get("WAREHOUSE");
      expect(res.status).toBe(403);
    });
  });

  describe("the mock reads", () => {
    it.each([
      ["observability", observabilityReportSchema],
      ["clickstream", clickstreamSummarySchema],
    ] as const)("%s answers labelled mock data", async (name, schema) => {
      const res = await call(
        t,
        as("MANAGEMENT"),
        "get",
        `${API}/monitoring/${name}`,
      );
      expect(res.status).toBe(200);
      expect(schema.parse(res.body).meta.mock).toBe(true);
      expect(
        (await call(t, as("WAREHOUSE"), "get", `${API}/monitoring/${name}`))
          .status,
      ).toBe(403);
    });
  });

  describe("POST /analytics/clickstream", () => {
    const post = (role: Role | null, body: object) =>
      call(t, role === null ? null : as(role), "post", CLICKS, {
        csrf: true,
        body,
      });

    it("stores role, route pattern, name and time, and nothing that names a person", async () => {
      const res = await post("APPROVER", {
        events: [click, { ...click, name: "action" }],
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { accepted: 2 } });
      const rows = await t.app.get(Database).client.clickstreamEvent.findMany();
      expect(rows).toHaveLength(2);
      expect(rows[0]?.role).toBe("APPROVER");
      expect(rows[0]?.route).toBe("/orders/:id");
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
        "createdAt",
        "id",
        "name",
        "occurredAt",
        "role",
        "route",
      ]);
    });

    it("takes the role from the session, never from the body", async () => {
      const res = await post("WAREHOUSE", {
        events: [{ ...click, role: "FINANCE" }],
      });
      expect(res.status).toBe(400);
    });

    it("refuses a user id, a raw URL and an oversized batch", async () => {
      const id = "0190a1b2-0000-7000-8000-000000000001";
      expect(
        (await post("APPROVER", { events: [{ ...click, userId: id }] })).status,
      ).toBe(400);
      expect(
        (
          await post("APPROVER", {
            events: [{ ...click, route: `/orders/${id}` }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await post("APPROVER", {
            events: [{ ...click, route: "/orders?email=a@b.test" }],
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await post("APPROVER", {
            events: Array.from({ length: 21 }, () => click),
          })
        ).status,
      ).toBe(400);
    });

    it("needs a session", async () => {
      const res = await request(t.app.getHttpServer())
        .post(CLICKS)
        .send({ events: [click] });
      expect([401, 403]).toContain(res.status);
    });

    it("is rate limited more strictly than the rest of the API", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 35; i += 1) {
        statuses.push((await post("MANAGEMENT", { events: [click] })).status);
      }
      // Earlier tests used some of the 30 allowed a minute, so find the first refusal.
      const first = statuses.indexOf(429);
      expect(first).toBeGreaterThan(0);
      expect(first).toBeLessThanOrEqual(30);
      expect(statuses.slice(0, first).every((s) => s === 200)).toBe(true);
    });
  });
});
