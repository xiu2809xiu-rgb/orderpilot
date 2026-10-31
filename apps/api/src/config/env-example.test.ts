import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { expand } from "dotenv-expand";
import { describe, expect, it } from "vitest";
import { ROLES } from "@orderpilot/shared";
import { Role } from "../generated/prisma/enums.js";
import { AppConfig } from "./app-config.js";
import { envSchema } from "./env.schema.js";

const root = resolve(import.meta.dirname, "../../../..");
const example = readFileSync(resolve(root, ".env.example"), "utf8");
const compose = readFileSync(resolve(root, "docker-compose.yml"), "utf8");

/** The file as the API reads it: values that refer to each other are filled in. */
function expanded(): Record<string, string> {
  const processEnv: Record<string, string> = {};
  const { parsed } = expand({ processEnv, parsed: parse(example) });
  return { ...parsed };
}

describe(".env.example", () => {
  it("is a valid environment as it stands, once the references are filled in", () => {
    expect(() => AppConfig.fromEnv(expanded())).not.toThrow();
  });

  it("documents every variable the API reads, set or as a commented example", () => {
    for (const name of Object.keys(envSchema.shape)) {
      expect(example, name).toMatch(new RegExp(`^#? ?${name}=`, "m"));
    }
  });

  it("builds every URL from the three ports, so one line moves them all", () => {
    const raw = parse(example);
    expect(raw.DATABASE_URL).toContain("${POSTGRES_PORT}");
    expect(raw.TEST_DATABASE_URL).toContain("${POSTGRES_PORT}");
    expect(raw.REDIS_URL).toContain("${REDIS_PORT}");
    expect(raw.TEST_REDIS_URL).toContain("${REDIS_PORT}");
    expect(raw.S3_ENDPOINT).toContain("${MINIO_PORT}");

    const values = expand({
      processEnv: {},
      parsed: {
        ...raw,
        POSTGRES_PORT: "5433",
        REDIS_PORT: "6380",
        MINIO_PORT: "9100",
      },
    }).parsed;
    expect(values?.DATABASE_URL).toContain("127.0.0.1:5433/");
    expect(values?.TEST_DATABASE_URL).toContain("127.0.0.1:5433/");
    expect(values?.REDIS_URL).toContain("127.0.0.1:6380/");
    expect(values?.TEST_REDIS_URL).toContain("127.0.0.1:6380/");
    expect(values?.S3_ENDPOINT).toBe("http://127.0.0.1:9100");
  });

  it("gives the tests their own database, Redis database and bucket", () => {
    const values = expanded();
    expect(values.TEST_POSTGRES_DB).not.toBe(values.POSTGRES_DB);
    expect(values.TEST_POSTGRES_DB).toContain("test");
    expect(values.TEST_REDIS_DB).not.toBe(values.REDIS_DB);
    expect(values.TEST_S3_BUCKET).not.toBe(values.S3_BUCKET);
    expect(
      values.TEST_DATABASE_URL?.endsWith(`/${values.TEST_POSTGRES_DB ?? ""}`),
    ).toBe(true);
    expect(
      values.TEST_REDIS_URL?.endsWith(`/${values.TEST_REDIS_DB ?? ""}`),
    ).toBe(true);
  });
});

describe("docker-compose.yml", () => {
  it("runs under the project name orderpilot", () => {
    expect(compose).toMatch(/^name: orderpilot$/m);
  });

  it("takes every variable it uses from .env.example, with the same default", () => {
    const raw = parse(example);
    const used = [...compose.matchAll(/\$\{([A-Z_]+):-([^}]*)\}/g)];
    expect(used.length).toBeGreaterThan(5);
    for (const [, name, fallback] of used) {
      expect(raw[name ?? ""], name).toBe(fallback);
    }
  });

  it("pins every image to a version, and binds ports to this machine only", () => {
    const images = [...compose.matchAll(/^\s+image: (\S+)$/gm)].map(
      (m) => m[1] ?? "",
    );
    expect(images).toHaveLength(3);
    for (const image of images)
      expect(image, image).toMatch(/:\d[\w.-]*$|:RELEASE\.[\w.-]+$/);
    for (const [, port] of compose.matchAll(/^\s+- "([^"]+:\d+:\d+)"$/gm)) {
      expect(port, port).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("has a health check for each service and a named volume for each store", () => {
    expect(compose.match(/^\s+healthcheck:$/gm)).toHaveLength(3);
    for (const volume of ["postgres-data", "redis-data", "minio-data"]) {
      expect(compose).toContain(`  ${volume}:`);
    }
  });
});

describe("the database roles", () => {
  it("match the roles in @orderpilot/shared", () => {
    expect(Object.values(Role).sort()).toEqual([...ROLES].sort());
  });
});
