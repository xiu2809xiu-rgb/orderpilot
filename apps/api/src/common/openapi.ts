import { applyDecorators } from "@nestjs/common";
import { ApiQuery, type ApiResponseSchemaHost } from "@nestjs/swagger";
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

/**
 * The query parameters of a route, one per field of a zod object schema, so
 * a generated hook types them. Put it on the handler next to
 * `ZodValidationPipe(schema)`, which stays the check that runs.
 */
export function openApiQuery(schema: z.ZodObject) {
  const json = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
  });
  const required = new Set(json.required ?? []);
  const decorators = Object.entries(json.properties ?? {}).map(
    ([name, property]) =>
      ApiQuery({
        name,
        required: required.has(name),
        schema: property as SchemaObject,
      }),
  );
  return applyDecorators(...decorators);
}
