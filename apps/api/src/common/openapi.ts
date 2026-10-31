import type { ApiResponseSchemaHost } from "@nestjs/swagger";
import { z } from "zod";

/**
 * A zod schema as the OpenAPI schema of a response, so the docs are written
 * from the same schema the code trusts and cannot drift from it.
 */
type SchemaObject = ApiResponseSchemaHost["schema"];

export function openApiSchema(schema: z.ZodType): SchemaObject {
  const json = z.toJSONSchema(schema, { target: "openapi-3.0", io: "output" });
  // OpenAPI 3.0 has no $schema keyword.
  const rest = Object.fromEntries(
    Object.entries(json).filter(([key]) => key !== "$schema"),
  );
  return rest;
}
