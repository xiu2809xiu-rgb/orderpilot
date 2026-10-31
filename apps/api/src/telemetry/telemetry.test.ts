import * as Sentry from "@sentry/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppConfig } from "../config/app-config.js";
import { bearerMatches } from "../modules/monitoring/metrics.controller.js";
import { plausibleTime } from "../modules/analytics/clickstream.service.js";
import { initSentry, scrubSentryEvent } from "./sentry.js";

const BASE_ENV = {
  APP_ENV: "local",
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/x",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_BUCKET: "orderpilot-test",
  COOKIE_SECURE: "false",
};

const DSN = "https://publickey@o0.ingest.example.test/1";

describe("the monitoring settings", () => {
  it("are all off when nothing is set", () => {
    const config = AppConfig.fromEnv(BASE_ENV);
    expect(config.monitoring).toEqual({
      otlpEndpoint: null,
      metricsToken: null,
      sentryDsn: null,
    });
  });

  it("drop a trailing slash from the collector address", () => {
    const config = AppConfig.fromEnv({
      ...BASE_ENV,
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318/",
    });
    expect(config.monitoring.otlpEndpoint).toBe("http://127.0.0.1:4318");
  });

  it("refuse a short metrics token", () => {
    expect(() =>
      AppConfig.fromEnv({ ...BASE_ENV, METRICS_TOKEN: "short" }),
    ).toThrow(/METRICS_TOKEN/);
  });
});

describe("the metrics bearer token", () => {
  const token = "a-long-random-token-for-the-test";
  it("matches only the exact token", () => {
    expect(bearerMatches(`Bearer ${token}`, token)).toBe(true);
    expect(bearerMatches(`Bearer ${token}x`, token)).toBe(false);
    expect(bearerMatches(`Bearer ${token.slice(1)}`, token)).toBe(false);
    expect(bearerMatches(token, token)).toBe(false);
    expect(bearerMatches(undefined, token)).toBe(false);
  });
});

describe("the time of a clickstream event", () => {
  const now = new Date("2026-11-01T08:00:00.000Z");
  it("keeps a plausible browser time", () => {
    const at = "2026-11-01T07:59:00.000Z";
    expect(plausibleTime(at, now).toISOString()).toBe(at);
  });
  it("uses the server time for a clock that is a day behind or far ahead", () => {
    expect(plausibleTime("2026-10-30T08:00:00.000Z", now)).toBe(now);
    expect(plausibleTime("2026-11-01T09:00:00.000Z", now)).toBe(now);
  });
});

describe("Sentry in the API", () => {
  afterEach(async () => {
    await Sentry.close(0);
  });

  it("does nothing without a DSN: no client exists, so nothing can be sent", async () => {
    expect(initSentry(AppConfig.fromEnv(BASE_ENV))).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();
    const fetched = vi.spyOn(globalThis, "fetch");
    Sentry.captureException(new Error("never sent"));
    await Sentry.flush(100);
    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });

  it("scrubs cookies, headers, the body, the query string and the user", () => {
    const event = scrubSentryEvent({
      type: undefined,
      user: { id: "u1", email: "someone@example.test" },
      request: {
        url: "https://app.example.test/api/v1/orders?token=SECRET#frag",
        method: "POST",
        cookies: { op_access: "SECRET" },
        headers: { authorization: "Bearer SECRET", cookie: "op_access=SECRET" },
        data: { bankAccount: "SECRET" },
        query_string: "token=SECRET",
      },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({
      url: "https://app.example.test/api/v1/orders",
      method: "POST",
    });
    expect(JSON.stringify(event)).not.toContain("SECRET");
  });

  it("sends only a scrubbed event once a DSN is set", async () => {
    const sent: string[] = [];
    const config = AppConfig.fromEnv({ ...BASE_ENV, SENTRY_DSN: DSN });
    expect(
      initSentry(config, {
        transport: () => ({
          send: (envelope) => {
            sent.push(JSON.stringify(envelope));
            return Promise.resolve({});
          },
          flush: () => Promise.resolve(true),
        }),
      }),
    ).toBe(true);

    Sentry.withScope((scope) => {
      scope.setUser({ id: "u1", email: "someone@example.test" });
      scope.setSDKProcessingMetadata({
        normalizedRequest: {
          url: "https://app.example.test/x?token=SECRET",
          headers: { authorization: "Bearer SECRET" },
          data: "SECRET",
        },
      });
      Sentry.captureException(new Error("boom"));
    });
    await Sentry.flush(1000);

    expect(sent.length).toBeGreaterThan(0);
    const body = sent.join("");
    expect(body).toContain("boom");
    expect(body).not.toContain("SECRET");
    expect(body).not.toContain("someone@example.test");
  });
});
