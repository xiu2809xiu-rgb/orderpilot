import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReadinessRegistry } from "../../src/health/readiness-registry.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

interface CheckBody {
  name: string;
  status: string;
}

describe("health probes", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("GET /health/live says the process is up", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok" } });
  });

  it("GET /health reports build, environment and checks", async () => {
    const res = await request(t.app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        status: "ok",
        name: "@orderpilot/api",
        appEnv: "local",
        checks: [],
      },
    });
    expect(res.body.data.uptimeSeconds).toBeTypeOf("number");
  });

  it("GET /health/ready is ready with no checks registered", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "ok", checks: [] });
  });

  it("serves the probes outside /api, so a version change never moves them", async () => {
    const res = await request(t.app.getHttpServer()).get("/api/health/live");
    expect(res.status).toBe(404);
  });
});

describe("readiness with checks registered", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    const registry = t.app.get(ReadinessRegistry);
    registry.register({ name: "good", check: () => Promise.resolve() });
  });
  afterAll(async () => {
    await t.close();
  });

  it("is ready while every check passes", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(200);
  });

  it("answers 503 when a check fails, and never sends the reason", async () => {
    t.app.get(ReadinessRegistry).register({
      name: "bad",
      check: () => Promise.reject(new Error("password=hunter2 refused")),
    });
    const res = await request(t.app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.data.status).toBe("unavailable");
    expect(
      (res.body.data.checks as CheckBody[]).map((c) => [c.name, c.status]),
    ).toEqual([
      ["bad", "down"],
      ["good", "up"],
    ]);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    // The reason is in the log, against the request.
    expect(JSON.stringify(t.logLines())).toContain("hunter2");
  });
});

describe("GET /api/v1/system/checks (the list pattern)", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    const registry = t.app.get(ReadinessRegistry);
    for (const name of ["database", "redis", "storage"]) {
      registry.register({ name, check: () => Promise.resolve() });
    }
  });
  afterAll(async () => {
    await t.close();
  });

  it("returns { data, meta } for a page", async () => {
    const res = await request(t.app.getHttpServer()).get(
      "/api/v1/system/checks?page=2&pageSize=2",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ name: "storage" }],
      meta: { page: 2, pageSize: 2, total: 3 },
    });
  });

  it("rejects a bad page with the error envelope and field details", async () => {
    const res = await request(t.app.getHttpServer())
      .get("/api/v1/system/checks?page=0")
      .set("X-Request-Id", "req-validate-1");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details).toEqual([
      { path: "page", message: expect.any(String) },
    ]);
    expect(res.body.error.traceId).toBe("req-validate-1");
  });
});
