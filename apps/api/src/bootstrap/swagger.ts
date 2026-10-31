import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { DOCS_PATH } from "../common/api-paths.js";
import { buildOpenApiDocument } from "./openapi-document.js";

export function setupSwagger(
  app: NestExpressApplication,
  version: string,
): void {
  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app, version), {
    customSiteTitle: "OrderPilot API",
    jsonDocumentUrl: `${DOCS_PATH}-json`,
  });
}
