import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { DOCS_PATH } from "../common/api-paths.js";

export function setupSwagger(
  app: NestExpressApplication,
  version: string,
): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("OrderPilot API")
      .setDescription(
        "AI reads, rules decide, people approve. Errors share one envelope: { error: { code, message, details, traceId } }.",
      )
      .setVersion(version)
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}-json`,
  });
}
