import { Controller, Get } from "@nestjs/common";
import { errorEnvelopeSchema, HEADERS } from "@orderpilot/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../support/test-app.js";

@Controller("boom")
class BoomController {
  @Get()
  boom(): never {
    throw new Error("secret table name: users_private");
  }
}

describe("the error envelope", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({}, [BoomController]);
  });
  afterAll(async () => {
    await t.close();
  });

  it("answers an unknown path under /api with a 404 envelope", async () => {
    const res = await request(t.app.getHttpServer()).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    expect(res.body.error.details).toBeNull();
  });

  it("answers an unknown path outside /api with the same envelope, not an HTML page", async () => {
    const res = await request(t.app.getHttpServer()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("uses the caller's X-Request-Id as the traceId and echoes it", async () => {
    const res = await request(t.app.getHttpServer())
      .get("/api/v1/nope")
      .set(HEADERS.requestId, "client-req-42");
    expect(res.headers[HEADERS.requestId.toLowerCase()]).toBe("client-req-42");
    expect(res.body.error.traceId).toBe("client-req-42");
  });

  it("makes up an id when the caller sends none, or an unsafe one", async () => {
    const none = await request(t.app.getHttpServer()).get("/api/v1/nope");
    expect(none.body.error.traceId).toMatch(/^[0-9a-f-]{36}$/);

    const unsafe = await request(t.app.getHttpServer())
      .get("/api/v1/nope")
      .set(HEADERS.requestId, "a b;{}");
    expect(unsafe.body.error.traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unsafe.headers[HEADERS.requestId.toLowerCase()]).toBe(
      unsafe.body.error.traceId,
    );
  });

  it("turns malformed JSON into a VALIDATION_FAILED envelope", async () => {
    const res = await request(t.app.getHttpServer())
      .post("/api/v1/system/checks")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("turns an oversized body into an envelope", async () => {
    const res = await request(t.app.getHttpServer())
      .post("/api/v1/system/checks")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("hides the cause of a bug and logs it against the trace id", async () => {
    const res = await request(t.app.getHttpServer())
      .get("/api/v1/boom")
      .set(HEADERS.requestId, "req-boom-1");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("users_private");
    expect(res.body.error.traceId).toBe("req-boom-1");

    const failure = t
      .logLines()
      .find(
        (line) =>
          line.msg === "Request failed" && line.requestId === "req-boom-1",
      );
    expect(failure).toBeDefined();
    expect(JSON.stringify(failure)).toContain("users_private");
  });
});

describe("rate limiting", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ RATE_LIMIT_MAX_REQUESTS: "3" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("answers the request over the limit with a RATE_LIMITED envelope", async () => {
    const server = t.app.getHttpServer();
    for (let i = 0; i < 3; i += 1) {
      const ok = await request(server).get("/api/v1/system/checks");
      expect(ok.status).toBe(200);
    }
    const res = await request(server).get("/api/v1/system/checks");
    expect(res.status).toBe(429);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe("RATE_LIMITED");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("does not limit the probes", async () => {
    const server = t.app.getHttpServer();
    for (let i = 0; i < 6; i += 1) {
      const res = await request(server).get("/health/live");
      expect(res.status).toBe(200);
    }
  });
});
