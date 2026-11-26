import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppConfig } from "../../src/config/app-config.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
  passwordSignIn,
  type Browser,
} from "../support/auth.js";
import { inProduction } from "../support/production-config.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, testEnv, type TestApp } from "../support/test-app.js";
import {
  clearTwoStep,
  enableTwoStep,
  errorCodeOf,
} from "../support/two-step.js";

const WORDS =
  "Resetting another person's two-step verification is switched off in production until that person is told about it.";

/**
 * The reset in an app whose services are told they run in production. Only the
 * injected configuration says so: the app itself starts as the other tests'
 * does (demo sign-in, example secrets), which production's own schema would
 * refuse.
 */
describe("an administrator's two-step reset, with the app in production", () => {
  let t: TestApp;
  let admin: Browser;
  let targetEmail: string;
  let targetId: string;

  beforeAll(async () => {
    await resetTestData();
    const production = inProduction(AppConfig.fromEnv(testEnv()));
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(AppConfig).useValue(production),
    );
    targetEmail = await emailForRole("SUPPORT");
    targetId = (await passwordSignIn(t, targetEmail)).session.user.id;
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    await clearTwoStep(t, targetEmail);
    admin = await demoSignIn(t, "SYSTEM_ADMIN");
  });

  const reset = (id: string) =>
    call(t, admin, "post", `${API}/users/${id}/two-step/reset`, {
      csrf: true,
    });
  const eventsOf = async (action: string) =>
    (await auditEvents(t)).filter((e) => e.action === action);

  it("refuses with a 409 CONFLICT in words for a person and changes nothing", async () => {
    const session = await passwordSignIn(t, targetEmail);
    await enableTwoStep(t, targetEmail);
    const doneBefore = (await eventsOf("user.two-step-reset")).length;
    const before = (await eventsOf("user.two-step-reset.refused")).length;

    const res = await reset(targetId);

    expect(res.status).toBe(409);
    expect(errorCodeOf(res)).toBe("CONFLICT");
    expect((res.body as { error: { message: string } }).error.message).toBe(
      WORDS,
    );
    expect(await t.app.get(TwoStepRepository).stateOf(targetId)).not.toBeNull();
    expect((await call(t, session, "get", `${API}/auth/me`)).status).toBe(200);
    const written = await eventsOf("user.two-step-reset.refused");
    expect(written).toHaveLength(before + 1);
    expect(written.at(-1)?.changes).toEqual({ reason: "production" });
    expect(written.at(-1)?.summary).toBe("A two-step reset was refused");
    expect(written.at(-1)?.entityId).toBe(targetId);
    expect(await eventsOf("user.two-step-reset")).toHaveLength(doneBefore);
  });

  it("refuses the administrator's own account for production, in one row", async () => {
    const adminEmail = await emailForRole("SYSTEM_ADMIN");
    const own = await enableTwoStep(t, adminEmail);
    const before = (await eventsOf("user.two-step-reset.refused")).length;

    const res = await reset(own.userId);

    expect(res.status).toBe(409);
    expect((res.body as { error: { message: string } }).error.message).toBe(
      WORDS,
    );
    const written = await eventsOf("user.two-step-reset.refused");
    expect(written).toHaveLength(before + 1);
    expect(written.at(-1)?.changes).toEqual({ reason: "production" });
    await clearTwoStep(t, adminEmail);
  });
});
