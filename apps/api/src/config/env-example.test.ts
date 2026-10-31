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

  it("shows the nine role buttons on a local run, and says production refuses them", () => {
    const values = expanded();
    expect(values.DEMO_MODE).toBe("true");
    expect(values.APP_ENV).toBe("local");
    expect(example).toMatch(/APP_ENV=production refuses it/);
    // The example turns it on; the API's own default, with no variable, is off.
    expect(envSchema.shape.DEMO_MODE.parse(undefined)).toBe(false);
    // And production does refuse it.
    expect(() =>
      AppConfig.fromEnv({
        ...values,
        APP_ENV: "production",
        COOKIE_SECURE: "true",
        JWT_SECRET: "x".repeat(48),
        CORS_ORIGINS: "https://orderpilot.example.test",
      }),
    ).toThrow(/DEMO_MODE/);
  });

  it("lets the web port move the allowed origin", () => {
    const raw = parse(example);
    expect(raw.CORS_ORIGINS).toContain("${WEB_PORT}");
    const values = expand({
      processEnv: {},
      parsed: { ...raw, WEB_PORT: "5900" },
    }).parsed;
    expect(values?.CORS_ORIGINS).toBe("http://localhost:5900");
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
    expect(images).toHaveLength(5);
    for (const image of images)
      expect(image, image).toMatch(/:v?\d[\w.-]*$|:RELEASE\.[\w.-]+$/);
    for (const [, port] of compose.matchAll(/^\s+- "([^"]+:\d+:\d+)"$/gm)) {
      expect(port, port).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("has a health check for each service and a named volume for each store", () => {
    expect(compose.match(/^\s+healthcheck:$/gm)).toHaveLength(5);
    for (const volume of [
      "postgres-data",
      "redis-data",
      "minio-data",
      "lgtm-data",
    ]) {
      expect(compose).toContain(`  ${volume}:`);
    }
  });
});

describe("the pgvector and Mailpit additions", () => {
  it("runs PostgreSQL from the pgvector image at one exact tag, and checks it over TCP", () => {
    expect(compose).toContain("image: pgvector/pgvector:0.8.6-pg18-trixie");
    expect(compose).toContain("pg_isready -h 127.0.0.1");
  });

  it("runs Mailpit, with SMTP settings built from its two ports", () => {
    expect(compose).toContain("image: axllent/mailpit:v1.32.0");
    const raw = parse(example);
    expect(raw.MAILPIT_SMTP_PORT).toBeDefined();
    expect(raw.MAILPIT_UI_PORT).toBeDefined();
    expect(raw.SMTP_PORT).toBe("${MAILPIT_SMTP_PORT}");
    expect(raw.SMTP_HOST).toBe("127.0.0.1");
  });
});

describe("the database roles", () => {
  it("match the roles in @orderpilot/shared", () => {
    expect(Object.values(Role).sort()).toEqual([...ROLES].sort());
  });
});

describe("the observability profile", () => {
  it("runs otel-lgtm at one exact tag, only under the observability profile", () => {
    expect(compose).toContain("image: grafana/otel-lgtm:0.38.0");
    expect(compose).toMatch(/otel-lgtm:\n\s+profiles: \["observability"\]/);
  });

  it("puts Grafana on its own port, never 3000 which the API may use", () => {
    const raw = parse(example);
    expect(raw.GRAFANA_PORT).toBeDefined();
    expect(raw.GRAFANA_PORT).not.toBe("3000");
    expect(compose).toContain("${GRAFANA_PORT:-3300}:3000");
  });

  it("leaves every monitoring setting off in the example file", () => {
    const config = AppConfig.fromEnv(expanded());
    expect(config.monitoring).toEqual({
      otlpEndpoint: null,
      metricsToken: null,
      sentryDsn: null,
    });
  });
});
