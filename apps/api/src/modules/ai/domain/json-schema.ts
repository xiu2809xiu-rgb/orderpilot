import { z } from "zod";
import type { JsonSchema } from "./llm-provider.js";

/**
 * The JSON Schema of a zod schema, as plain data for the provider port. It
 * describes what a model may SEND (`io: "input"`): a field with a default is
 * optional there. Zod, not the provider, still decides whether an answer is
 * valid, so a provider that ignores the schema changes nothing about safety.
 */
export function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  // The round trip makes sure only JSON survives: no undefined, no function.
  const plain: unknown = JSON.parse(
    JSON.stringify(z.toJSONSchema(schema, { io: "input" })),
  );
  if (typeof plain !== "object" || plain === null || Array.isArray(plain)) {
    throw new RangeError("A model-facing schema must be a JSON object.");
  }
  // Some providers reject the draft marker, and none needs it.
  const described: Record<string, unknown> = {
    ...(plain as Record<string, unknown>),
  };
  delete described.$schema;
  return described as JsonSchema;
}
