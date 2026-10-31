import { describe, expect, it } from "vitest";
import { AppConfig } from "./app-config.js";
import { ConfigError } from "./config-error.js";

const valid = { APP_ENV: "local" };

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
      APP_ENV: "local",
      API_PORT: "not-a-port-SECRET",
      LOG_LEVEL: "loud-SECRET",
    });
    expect(message).toContain("API_PORT");
    expect(message).toContain("LOG_LEVEL");
    expect(message).not.toContain("SECRET");
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
  const production = {
    APP_ENV: "production",
    CORS_ORIGINS: "https://app.example.com",
  };

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
    const config = AppConfig.fromEnv({
      APP_ENV: "demo",
      NODE_ENV: "production",
      DEMO_MODE: "true",
    });
    expect(config.isProduction).toBe(false);
    expect(config.demoMode).toBe(true);
  });
});
