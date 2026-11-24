import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { demoSignIn, type Browser } from "../support/auth.js";
import {
  HandClock,
  availabilityCalls,
  codeOf,
  idOf,
} from "../support/availability.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("the limits of the availability routes", () => {
  let t: TestApp;
  let support: Browser;
  let api: ReturnType<typeof availabilityCalls>;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(new HandClock()),
    );
    // This file is about the limit, so it takes the whole budget.
    api = availabilityCalls(t, 1000);
    support = await demoSignIn(t, "SUPPORT");
  });
  afterAll(async () => {
    await t.close();
  });

  it("answers 429 RATE_LIMITED in the error envelope after 30 PUTs in a minute, and still answers mine", async () => {
    for (let n = 0; n < 30; n += 1) {
      expect((await api.set(support, "FOCUSING")).status).toBe(200);
    }
    const limited = await api.set(support, "FOCUSING");
    expect(limited.status).toBe(429);
    expect(codeOf(limited.body)).toBe("RATE_LIMITED");
    expect((await api.mine(support)).status).toBe(200);
  });

  it("answers 429 RATE_LIMITED after 120 lookups in a minute, and still answers mine", async () => {
    for (let n = 0; n < 120; n += 1) {
      expect((await api.lookup(support, idOf(support))).status).toBe(200);
    }
    const limited = await api.lookup(support, idOf(support));
    expect(limited.status).toBe(429);
    expect(codeOf(limited.body)).toBe("RATE_LIMITED");
    expect((await api.mine(support)).status).toBe(200);
  });
});
