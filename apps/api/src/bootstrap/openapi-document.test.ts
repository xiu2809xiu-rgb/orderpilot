import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { baseEnv } from "../../test/support/base-env.js";
import { AppConfig } from "../config/app-config.js";
import { buildOpenApiDocument } from "./openapi-document.js";
import { applyRouting } from "./routing.js";

async function documentOf(demoMode = true) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(
      AppConfig.fromEnv(baseEnv({ DEMO_MODE: String(demoMode) })),
    ),
    { preview: true, logger: false },
  );
  applyRouting(app);
  const document = buildOpenApiDocument(app, "0.0.0");
  await app.close();
  return document;
}

describe("the OpenAPI document (what orval reads)", () => {
  it("is built with no database, Redis or .env, from the real routes", async () => {
    const document = await documentOf();
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/v1/analytics/clickstream",
      "/api/v1/auth/demo-login",
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/auth/me",
      "/api/v1/auth/options",
      "/api/v1/auth/refresh",
      "/api/v1/governance/ai-destinations",
      "/api/v1/governance/ai-destinations/check",
      "/api/v1/governance/masking/sample",
      "/api/v1/governance/matrix",
      "/api/v1/governance/matrix/copy",
      "/api/v1/governance/matrix/{role}/data-scope",
      "/api/v1/governance/matrix/{role}/permissions/{permission}",
      "/api/v1/monitoring/ai-usage",
      "/api/v1/monitoring/clickstream",
      "/api/v1/monitoring/observability",
      "/api/v1/system/checks",
      "/api/v1/users",
      "/api/v1/users/{id}",
      "/api/v1/users/{id}/disable",
      "/api/v1/users/{id}/enable",
      "/health",
      "/health/live",
      "/health/ready",
    ]);
  });

  it("leaves the demo sign-in out when DEMO_MODE is off", async () => {
    const { paths } = await documentOf(false);
    expect(paths["/api/v1/auth/demo-login"]).toBeUndefined();
    expect(paths["/api/v1/auth/login"]).toBeDefined();
  });

  it("describes the sign-in answer with the shared contract schema", async () => {
    const { paths } = await documentOf();
    const login = paths["/api/v1/auth/login"]?.post;
    expect(login?.operationId).toBe("Auth_login");
    expect(JSON.stringify(login?.responses["200"])).toContain('"permissions"');
    expect(JSON.stringify(login?.requestBody)).toContain('"password"');
  });

  it("carries the zod schemas, the query and readable operation ids", async () => {
    const { paths } = await documentOf();
    const checks = paths["/api/v1/system/checks"]?.get;
    expect(checks?.operationId).toBe("System_checks");
    expect(checks?.parameters).toMatchObject([
      { name: "page", in: "query", required: false },
      { name: "pageSize", in: "query", required: false },
    ]);
    expect(JSON.stringify(checks?.responses["200"])).toContain(
      '"required":["data","meta"]',
    );
  });
});
