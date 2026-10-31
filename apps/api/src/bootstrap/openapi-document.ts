import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";

/**
 * The OpenAPI document. Swagger UI serves it and `pnpm api:spec` writes it to
 * apps/api/openapi.json, which orval reads to generate the web app's hooks.
 *
 * Operation ids read `System_checks`, so a generated hook is `useSystemChecks`
 * and never `useSystemControllerChecks`.
 */
export function buildOpenApiDocument(
  app: NestExpressApplication,
  version: string,
): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("OrderPilot API")
      .setDescription(
        "AI reads, rules decide, people approve. Errors share one envelope: { error: { code, message, details, traceId } }.",
      )
      .setVersion(version)
      .build(),
    {
      operationIdFactory: (controllerKey, methodKey) =>
        `${controllerKey.replace(/Controller$/, "")}_${methodKey}`,
    },
  );
}
