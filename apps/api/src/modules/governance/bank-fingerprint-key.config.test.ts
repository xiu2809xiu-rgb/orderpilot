import { describe, expect, it } from "vitest";
import { baseEnv } from "../../../test/support/base-env.js";
import { AppConfig } from "../../config/app-config.js";
import { LOCAL_BANK_FINGERPRINT_KEY } from "../../config/env.schema.js";

const OWN_KEY = "a-long-fingerprint-key-for-this-test-only-0123456789";
const DEMO_STACK = {
  APP_ENV: "demo",
  COOKIE_SECURE: "true",
  JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
};
const PRODUCTION = {
  APP_ENV: "production",
  CORS_ORIGINS: "https://app.example.com",
  JWT_SECRET: "a-long-random-secret-for-this-test-only-0123456789",
};

describe("BANK_FINGERPRINT_KEY", () => {
  it("is null when it is not set, so that a comparison fails closed", () => {
    expect(AppConfig.fromEnv(baseEnv()).governance.bankFingerprintKey).toBe(
      null,
    );
  });

  it("is read when it is set", () => {
    const config = AppConfig.fromEnv(
      baseEnv({ BANK_FINGERPRINT_KEY: OWN_KEY }),
    );
    expect(config.governance.bankFingerprintKey).toBe(OWN_KEY);
  });

  it("refuses a key too short to be secret", () => {
    expect(() =>
      AppConfig.fromEnv(baseEnv({ BANK_FINGERPRINT_KEY: "too-short" })),
    ).toThrow(/BANK_FINGERPRINT_KEY/);
  });

  it("allows the public value on a laptop only", () => {
    const key = { BANK_FINGERPRINT_KEY: LOCAL_BANK_FINGERPRINT_KEY };
    expect(() => AppConfig.fromEnv(baseEnv(key))).not.toThrow();
    for (const env of [DEMO_STACK, PRODUCTION]) {
      expect(
        () => AppConfig.fromEnv(baseEnv({ ...env, ...key })),
        env.APP_ENV,
      ).toThrow(/BANK_FINGERPRINT_KEY/);
    }
  });

  it("accepts an own key everywhere", () => {
    for (const env of [DEMO_STACK, PRODUCTION]) {
      expect(
        () =>
          AppConfig.fromEnv(baseEnv({ ...env, BANK_FINGERPRINT_KEY: OWN_KEY })),
        env.APP_ENV,
      ).not.toThrow();
    }
  });
});
