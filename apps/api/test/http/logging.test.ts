import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRootLogger } from "../../src/logging/logger.config.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("request logging", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("writes exactly one JSON line per request, keyed by the request id", async () => {
    await request(t.app.getHttpServer())
      .get("/api/v1/system/checks")
      .set("X-Request-Id", "log-one-1");
    await request(t.app.getHttpServer())
      .get("/nope")
      .set("X-Request-Id", "log-one-2");

    const lines = t
      .logLines()
      .filter((line) => String(line.requestId).startsWith("log-one-"));
    expect(lines.map((line) => line.requestId).sort()).toEqual([
      "log-one-1",
      "log-one-2",
    ]);
    expect(lines.find((line) => line.requestId === "log-one-1")).toMatchObject({
      level: 30,
      req: { method: "GET", url: "/api/v1/system/checks" },
      res: { statusCode: 200 },
    });
    // A refusal is a warning, so it stands out.
    expect(lines.find((line) => line.requestId === "log-one-2")).toMatchObject({
      level: 40,
      res: { statusCode: 404 },
    });
  });

  it("redacts cookies and credentials", async () => {
    await request(t.app.getHttpServer())
      .get("/api/v1/system/checks")
      .set("X-Request-Id", "log-redact-1")
      .set("Cookie", "op_access=SECRET-ACCESS; op_refresh=SECRET-REFRESH")
      .set("Authorization", "Bearer SECRET-BEARER")
      .set("X-CSRF-Token", "SECRET-CSRF");
    const raw = JSON.stringify(
      t.logLines().filter((line) => line.requestId === "log-redact-1"),
    );
    expect(raw).toContain("[redacted]");
    expect(raw).not.toContain("SECRET");
  });

  it("redacts Set-Cookie on responses", () => {
    const chunks: string[] = [];
    const logger = createRootLogger(t.config, {
      write: (line: string) => {
        chunks.push(line);
      },
    });
    logger.info(
      { res: { headers: { "set-cookie": ["op_access=SECRET"] } } },
      "x",
    );
    expect(chunks.join("")).not.toContain("SECRET");
  });
});
