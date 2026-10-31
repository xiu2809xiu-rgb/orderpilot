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

  it("GET /health shows only the status and the checks, each up", async () => {
    const res = await request(t.app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        status: "ok",
        checks: [
          { name: "database", status: "up" },
          { name: "redis", status: "up" },
          { name: "storage", status: "up" },
        ],
      },
    });
  });

  it("GET /health does not reveal the environment, version, uptime or timings", async () => {
    const res = await request(t.app.getHttpServer()).get("/health");
    const text = JSON.stringify(res.body);
    for (const secret of [
      "appEnv",
      "version",
      "gitSha",
      "uptime",
      "durationMs",
      "@orderpilot",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("GET /health/ready is ready when the database, Redis and storage answer", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(
      (res.body.data.checks as CheckBody[]).map((c) => [c.name, c.status]),
    ).toEqual([
      ["database", "up"],
      ["redis", "up"],
      ["storage", "up"],
    ]);
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
      ["database", "up"],
      ["good", "up"],
      ["redis", "up"],
      ["storage", "up"],
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

describe("readiness when a service is unreachable", () => {
  let t: TestApp;
  beforeAll(async () => {
    // Nothing listens on port 1. The password is set apart so that no
    // connection string with a password sits in the file.
    const unreachable = new URL("postgresql://127.0.0.1:1/none");
    unreachable.username = "nobody";
    unreachable.password = "nothing";
    t = await createTestApp({
      DATABASE_URL: unreachable.toString(),
      REDIS_URL: "redis://127.0.0.1:1/0",
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("answers 503 and names what is down, without the reason or the address", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(503);
    const down = (res.body.data.checks as CheckBody[])
      .filter((c) => c.status === "down")
      .map((c) => c.name);
    expect(down).toEqual(["database", "redis"]);
    expect(JSON.stringify(res.body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(res.body)).not.toContain("nothing");
  });

  it("keeps liveness up: a dead database never restarts the process", async () => {
    const res = await request(t.app.getHttpServer()).get("/health/live");
    expect(res.status).toBe(200);
  });
});
