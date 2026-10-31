import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../support/test-app.js";

const STRICT_CSP =
  "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'";

describe("security headers and CORS", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({
      CORS_ORIGINS: "http://localhost:5173,https://demo.example.com",
    });
  });
  afterAll(async () => {
    await t.close();
  });

  it("sends exactly the strict CSP on API responses, with none of helmet's defaults", async () => {
    const res = await request(t.app.getHttpServer()).get(
      "/api/v1/system/checks",
    );
    expect(res.headers["content-security-policy"]).toBe(STRICT_CSP);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("sends the strict CSP on errors and on the probes too", async () => {
    for (const path of ["/nope", "/api/v1/nope", "/health/live"]) {
      const res = await request(t.app.getHttpServer()).get(path);
      expect(res.headers["content-security-policy"], path).toBe(STRICT_CSP);
    }
  });

  it("allows a listed origin, with credentials", async () => {
    const res = await request(t.app.getHttpServer())
      .get("/api/v1/system/checks")
      .set("Origin", "https://demo.example.com");
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://demo.example.com",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-expose-headers"]).toContain(
      "X-Request-Id",
    );
  });

  it("gives an origin that is not listed no CORS headers", async () => {
    const res = await request(t.app.getHttpServer())
      .get("/api/v1/system/checks")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers a preflight from a listed origin, and refuses one from another", async () => {
    const ok = await request(t.app.getHttpServer())
      .options("/api/v1/system/checks")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-csrf-token");
    expect(ok.status).toBe(204);
    expect(ok.headers["access-control-allow-headers"]).toContain(
      "X-CSRF-Token",
    );

    const bad = await request(t.app.getHttpServer())
      .options("/api/v1/system/checks")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "POST");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Swagger", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("serves OrderPilot API at /api/docs with its own, relaxed CSP", async () => {
    const res = await request(t.app.getHttpServer()).get("/api/docs");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>OrderPilot API</title>");
    const csp = res.headers["content-security-policy"] ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toBe(STRICT_CSP);
  });

  it("documents the routes under the versioned base path, titled OrderPilot API", async () => {
    const res = await request(t.app.getHttpServer()).get("/api/docs-json");
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe("OrderPilot API");
    expect(Object.keys(res.body.paths as object)).toEqual(
      expect.arrayContaining(["/api/v1/system/checks", "/health/live"]),
    );
  });

  it("is off in production unless asked for", async () => {
    const prod = await createTestApp({
      APP_ENV: "production",
      CORS_ORIGINS: "https://app.example.com",
      DEMO_MODE: "false",
      DEMO_PASSWORD: undefined,
      COOKIE_SECURE: "true",
      JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
    });
    try {
      const res = await request(prod.app.getHttpServer()).get("/api/docs");
      expect(res.status).toBe(404);
      expect(res.headers["content-security-policy"]).toBe(STRICT_CSP);
    } finally {
      await prod.close();
    }
  });
});
