import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { AppConfig } from "../config/app-config.js";
import { buildOpenApiDocument } from "./openapi-document.js";
import { applyRouting } from "./routing.js";

async function documentOf() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(AppConfig.fromEnv({ APP_ENV: "local" })),
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
      "/api/v1/system/checks",
      "/health",
      "/health/live",
      "/health/ready",
    ]);
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
