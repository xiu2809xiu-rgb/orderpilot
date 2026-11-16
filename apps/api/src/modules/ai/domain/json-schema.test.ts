import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonSchemaOf } from "./json-schema.js";

describe("jsonSchemaOf", () => {
  it("describes an object with its required fields and no draft marker", () => {
    const schema = jsonSchemaOf(
      z.object({ sku: z.string(), quantity: z.int().min(1) }),
    );
    expect(schema).toMatchObject({
      type: "object",
      required: ["sku", "quantity"],
    });
    expect(schema).not.toHaveProperty("$schema");
  });

  it("leaves a field with a default optional, as the model may omit it", () => {
    const schema = jsonSchemaOf(
      z.object({ sku: z.string(), note: z.string().default("") }),
    );
    expect(schema.required).toEqual(["sku"]);
  });

  it("is plain data that survives a JSON round trip", () => {
    const schema = jsonSchemaOf(z.object({ a: z.enum(["x", "y"]) }));
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
});
