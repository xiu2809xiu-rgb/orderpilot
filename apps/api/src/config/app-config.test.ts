import { describe, expect, it } from "vitest";
import { baseEnv } from "../../test/support/base-env.js";
import { AppConfig } from "./app-config.js";
import { ConfigError } from "./config-error.js";
import { DEFAULT_JWT_SECRET } from "./env.schema.js";

const valid = baseEnv();

function messageFor(
  env: NodeJS.ProcessEnv,
  hints?: Parameters<typeof AppConfig.fromEnv>[1],
): string {
  try {
    AppConfig.fromEnv(env, hints);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).message;
  }
  throw new Error("expected a ConfigError");
}

describe("AppConfig.fromEnv", () => {
  it("fills every optional variable with a safe default", () => {
    const config = AppConfig.fromEnv(valid);
    expect(config.appEnv).toBe("local");
    expect(config.nodeEnv).toBe("development");
    expect(config.demoMode).toBe(false);
    expect(config.http).toMatchObject({
      host: "127.0.0.1",
      port: 3000,
      trustProxyHops: 0,
      corsOrigins: ["http://localhost:5173"],
      swaggerEnabled: true,
    });
    expect(config.rateLimit).toEqual({ windowSeconds: 60, maxRequests: 300 });
    expect(config.logLevel).toBe("info");
    expect(config.gitSha).toBeNull();
  });

  it("reads and coerces values", () => {
    const config = AppConfig.fromEnv({
      ...valid,
      API_PORT: "4100",
      DEMO_MODE: "true",
      CORS_ORIGINS: "http://localhost:5173, https://demo.example.com ,",
      TRUST_PROXY_HOPS: "1",
    });
    expect(config.http.port).toBe(4100);
    expect(config.demoMode).toBe(true);
    expect(config.http.corsOrigins).toEqual([
      "http://localhost:5173",
      "https://demo.example.com",
    ]);
    expect(config.http.trustProxyHops).toBe(1);
  });

  it("requires APP_ENV: a missing value never falls back to local", () => {
    expect(messageFor({})).toContain("APP_ENV: is missing.");
    expect(messageFor({ APP_ENV: "staging" })).toContain("APP_ENV:");
  });

  it("names the file to create and every file it reads", () => {
    const message = messageFor(
      {},
      {
        createFile: "/repo/.env",
        readFiles: ["/repo/apps/api/.env", "/repo/.env"],
      },
    );
    expect(message).toContain("Create /repo/.env by copying .env.example");
    expect(message).toContain("/repo/apps/api/.env, then /repo/.env");
    expect(message).toContain("never overrides what the shell sets");
  });

  it("reports every problem at once and never repeats a value", () => {
    const message = messageFor({
      ...valid,
      API_PORT: "not-a-port-SECRET",
      LOG_LEVEL: "loud-SECRET",
    });
    expect(message).toContain("API_PORT");
    expect(message).toContain("LOG_LEVEL");
    expect(message).not.toContain("SECRET");
  });

  it("requires the database, Redis and storage settings, and names them", () => {
    const message = messageFor({ APP_ENV: "local" });
    for (const name of [
      "DATABASE_URL",
      "REDIS_URL",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "S3_BUCKET",
    ]) {
      expect(message).toContain(`${name}: is missing.`);
    }
  });

  it("checks the shape of the URLs and the bucket name without repeating them", () => {
    const message = messageFor({
      ...valid,
      DATABASE_URL: "mysql://u:SECRET@h/db",
      REDIS_URL: "http://SECRET",
      S3_BUCKET: "Bad_Bucket_SECRET",
    });
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("REDIS_URL");
    expect(message).toContain("S3_BUCKET");
    expect(message).not.toContain("SECRET");
  });

  it("reads the infrastructure settings, with path-style on when an endpoint is set", () => {
    const config = AppConfig.fromEnv(valid);
    expect(config.database.url).toBe(valid.DATABASE_URL);
    expect(config.redis.url).toBe(valid.REDIS_URL);
    expect(config.storage).toMatchObject({
      endpoint: "http://127.0.0.1:5997",
      region: "us-east-1",
      bucket: "unit-bucket",
      forcePathStyle: true,
      createBucket: false,
    });
    const aws = AppConfig.fromEnv({ ...valid, S3_ENDPOINT: undefined });
    expect(aws.storage.endpoint).toBeNull();
    expect(aws.storage.forcePathStyle).toBe(false);
  });

  it("rejects an origin with a path, and a wildcard", () => {
    expect(
      messageFor({ ...valid, CORS_ORIGINS: "http://a.example.com/x" }),
    ).toContain("CORS_ORIGINS");
    expect(messageFor({ ...valid, CORS_ORIGINS: "*" })).toContain(
      "CORS_ORIGINS",
    );
  });
});

describe("production safety rules key off APP_ENV", () => {
  const production = baseEnv({
    APP_ENV: "production",
    CORS_ORIGINS: "https://app.example.com",
    JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
  });

  it("refuses the public default JWT secret on a demo stack, and allows it locally", () => {
    const demo = { ...valid, APP_ENV: "demo", COOKIE_SECURE: "true" };
    const withoutSecret = Object.fromEntries(
      Object.entries(demo).filter(([name]) => name !== "JWT_SECRET"),
    );
    expect(messageFor(withoutSecret)).toContain("JWT_SECRET");
    expect(messageFor({ ...demo, JWT_SECRET: DEFAULT_JWT_SECRET })).toContain(
      "JWT_SECRET",
    );
    expect(() =>
      AppConfig.fromEnv({ ...valid, JWT_SECRET: DEFAULT_JWT_SECRET }),
    ).not.toThrow();
  });

  it("refuses the default or a short JWT secret, and demo passwords, in production", () => {
    const withoutSecret = Object.fromEntries(
      Object.entries(production).filter(([name]) => name !== "JWT_SECRET"),
    );
    expect(messageFor(withoutSecret)).toContain("JWT_SECRET");
    expect(
      messageFor({ ...production, JWT_SECRET: DEFAULT_JWT_SECRET }),
    ).toContain("JWT_SECRET");
    expect(messageFor({ ...production, JWT_SECRET: "too-short" })).toContain(
      "JWT_SECRET",
    );
    expect(
      messageFor({ ...production, DEMO_PASSWORD: "demo-password-1" }),
    ).toContain("DEMO_PASSWORD");
  });

  it("accepts a sound production setting, with Swagger off by default", () => {
    const config = AppConfig.fromEnv(production);
    expect(config.isProduction).toBe(true);
    expect(config.http.swaggerEnabled).toBe(false);
  });

  it("lets Swagger be switched on in production on purpose", () => {
    expect(
      AppConfig.fromEnv({ ...production, SWAGGER_ENABLED: "true" }).http
        .swaggerEnabled,
    ).toBe(true);
  });

  it("refuses demo mode and plain-http origins when APP_ENV is production", () => {
    expect(messageFor({ ...production, DEMO_MODE: "true" })).toContain(
      "DEMO_MODE",
    );
    expect(
      messageFor({ ...production, CORS_ORIGINS: "http://app.example.com" }),
    ).toContain("https");
  });

  it("does not treat NODE_ENV=production as APP_ENV=production", () => {
    // A demo stack runs NODE_ENV=production with DEMO_MODE=true.
    const config = AppConfig.fromEnv(
      baseEnv({
        APP_ENV: "demo",
        NODE_ENV: "production",
        DEMO_MODE: "true",
        JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
      }),
    );
    expect(config.isProduction).toBe(false);
    expect(config.demoMode).toBe(true);
  });
});

describe("session settings", () => {
  it("defaults to a 15 minute access token, a 7 day refresh token and Secure cookies", () => {
    const { auth } = AppConfig.fromEnv(baseEnv());
    expect(auth.accessTokenTtlSeconds).toBe(900);
    expect(auth.refreshTokenTtlSeconds).toBe(604_800);
    expect(auth.cookieSecure).toBe(true);
    expect(auth.demoPassword).toBeNull();
  });

  it("lets only APP_ENV=local switch off Secure cookies", () => {
    expect(
      AppConfig.fromEnv(baseEnv({ COOKIE_SECURE: "false" })).auth.cookieSecure,
    ).toBe(false);
    for (const appEnv of ["demo", "production"]) {
      expect(
        messageFor(
          baseEnv({
            APP_ENV: appEnv,
            COOKIE_SECURE: "false",
            CORS_ORIGINS: "https://app.example.com",
            JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
          }),
        ),
      ).toContain("COOKIE_SECURE");
    }
  });

  it("refuses a JWT secret shorter than 32 characters anywhere", () => {
    expect(messageFor(baseEnv({ JWT_SECRET: "short" }))).toContain(
      "JWT_SECRET",
    );
  });
});
