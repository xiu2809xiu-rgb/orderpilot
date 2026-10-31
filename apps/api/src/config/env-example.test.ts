import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { describe, expect, it } from "vitest";
import { AppConfig } from "./app-config.js";
import { envSchema } from "./env.schema.js";

const example = readFileSync(
  resolve(import.meta.dirname, "../../../../.env.example"),
  "utf8",
);

describe(".env.example", () => {
  it("is a valid environment as it stands", () => {
    expect(() => AppConfig.fromEnv(parse(example))).not.toThrow();
  });

  it("documents every variable the API reads, set or as a commented example", () => {
    for (const name of Object.keys(envSchema.shape)) {
      expect(example, name).toMatch(new RegExp(`^#? ?${name}=`, "m"));
    }
  });
});
