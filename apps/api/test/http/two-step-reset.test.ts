import { ROLES, type Role } from "@orderpilot/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { RecoveryCodeRepository } from "../../src/two-step/recovery-code.repository.js";
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
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  clearTwoStep,
  enableTwoStep,
  errorCodeOf,
  passwordLogin,
  startChallenge,
  wrongTries,
} from "../support/two-step.js";

describe("an administrator resets two-step", () => {
  let t: TestApp;
  let clock: TestClock;
  let admin: Browser;
  let targetEmail: string;
  let targetId: string;

  beforeAll(async () => {
    await resetTestData();
    clock = new TestClock();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(clock),
    );
    targetEmail = await emailForRole("SUPPORT");
    targetId = (await passwordSignIn(t, targetEmail)).session.user.id;
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    clock.set(FIXED_NOW);
    await clearTwoStep(t, targetEmail);
    admin = await demoSignIn(t, "SYSTEM_ADMIN");
  });

  const reset = (browser: Browser, id: string) =>
    call(t, browser, "post", `${API}/users/${id}/two-step/reset`, {
      csrf: true,
    });
  const events = async (action: string) =>
    (await auditEvents(t)).filter((e) => e.action === action);
  const stateOfTarget = () => t.app.get(TwoStepRepository).stateOf(targetId);

  it("lets only a holder of users.manage reset (the other eight roles get 403)", async () => {
    await enableTwoStep(t, targetEmail);
    const others = ROLES.filter((role: Role) => role !== "SYSTEM_ADMIN");
    expect(others).toHaveLength(8);
    for (const role of others) {
      const res = await reset(await demoSignIn(t, role), targetId);
      expect(res.status, role).toBe(403);
      expect(errorCodeOf(res)).toBe("FORBIDDEN");
    }
    expect(await stateOfTarget()).not.toBeNull();

    const ok = await reset(admin, targetId);

    expect(ok.status).toBe(200);
    // The demo sign-ins above are of other accounts, and none of the target's
    // password sign-ins is open: nothing to end.
    expect((ok.body as { data: { wasOn: boolean } }).data.wasOn).toBe(true);
    expect(await stateOfTarget()).toBeNull();
  });

  it("refuses a reset of oneself and audits the refusal", async () => {
    const adminEmail = await emailForRole("SYSTEM_ADMIN");
    const own = await enableTwoStep(t, adminEmail);
    const before = (await events("user.two-step-reset")).length;

    const res = await reset(admin, own.userId);

    expect(res.status).toBe(409);
    expect(errorCodeOf(res)).toBe("CONFLICT");
    expect((res.body as { error: { message: string } }).error.message).toBe(
      "You cannot reset your own two-step verification.",
    );
    expect(
      await t.app.get(TwoStepRepository).stateOf(own.userId),
    ).not.toBeNull();
    const refused = (await events("user.two-step-reset.refused")).at(-1);
    expect(refused?.changes).toEqual({ reason: "self" });
    expect(refused?.summary).toBe("A two-step reset was refused");
    expect(refused?.entityId).toBe(own.userId);
    expect(await events("user.two-step-reset")).toHaveLength(before);
    await clearTwoStep(t, adminEmail);
  });

  it("ends every session of the person, demo ones too, and audits it", async () => {
    const password = await passwordSignIn(t, targetEmail);
    const demo = await demoSignIn(t, "SUPPORT");
    const other = await demoSignIn(t, "WAREHOUSE");
    await enableTwoStep(t, targetEmail);

    const res = await reset(admin, targetId);

    const ended = (res.body as { data: { sessionsEnded: number } }).data
      .sessionsEnded;
    expect(ended).toBeGreaterThanOrEqual(2);
    for (const gone of [password, demo]) {
      expect((await call(t, gone, "get", `${API}/auth/me`)).status).toBe(401);
    }
    expect((await call(t, other, "get", `${API}/auth/me`)).status).toBe(200);
    const done = (await events("user.two-step-reset")).at(-1);
    expect(done?.changes).toEqual({ sessionsEnded: ended });
    expect(done?.entityId).toBe(targetId);
    expect(done?.actor).toMatchObject({
      kind: "user",
      userId: admin.session.user.id,
    });
    expect(done?.summary).toBe(
      "Two-step verification was reset by an administrator",
    );
    // The person signs in with the password alone again.
    expect((await passwordLogin(t, targetEmail)).status).toBe(200);
  });

  it("clears the lock", async () => {
    const account = await enableTwoStep(t, targetEmail);
    for (let round = 0; round < 2; round += 1) {
      const token = await startChallenge(t, targetEmail);
      await wrongTries(t, token, account, clock.now(), 5);
    }
    expect((await stateOfTarget())?.lockedUntil).not.toBeNull();

    await reset(admin, targetId);

    expect(await stateOfTarget()).toBeNull();
    expect(await t.app.get(RecoveryCodeRepository).countUnused(targetId)).toBe(
      0,
    );
    expect((await passwordLogin(t, targetEmail)).status).toBe(200);
  });

  it("answers a reset of a person with no two-step as a no-op", async () => {
    const session = await passwordSignIn(t, targetEmail);
    const before = (await events("user.two-step-reset")).length;

    const res = await reset(admin, targetId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { wasOn: false, sessionsEnded: 0 } });
    expect((await events("user.two-step-reset")).length).toBe(before);
    expect((await call(t, session, "get", `${API}/auth/me`)).status).toBe(200);
  });

  it("drops a setup nobody confirmed, audits it and leaves the sessions alone", async () => {
    const session = await passwordSignIn(t, targetEmail);
    await t.app
      .get(TwoStepRepository)
      .startSetup(targetId, "pending", FIXED_NOW);
    const before = (await events("user.two-step-reset")).length;

    const res = await reset(admin, targetId);

    expect(res.body).toEqual({ data: { wasOn: false, sessionsEnded: 0 } });
    expect(await stateOfTarget()).toBeNull();
    const written = await events("user.two-step-reset");
    expect(written.length).toBe(before + 1);
    expect(written.at(-1)?.changes).toEqual({
      wasOn: false,
      pendingRemoved: true,
    });
    expect((await call(t, session, "get", `${API}/auth/me`)).status).toBe(200);
  });

  it("answers 404 for an unknown person and 400 for a bad id", async () => {
    const unknown = await reset(admin, "00000000-0000-7000-8000-0000000000ff");
    expect(unknown.status).toBe(404);
    expect(errorCodeOf(unknown)).toBe("NOT_FOUND");
    expect((await reset(admin, "not-an-id")).status).toBe(400);
  });

  it("needs the CSRF token", async () => {
    const res = await call(
      t,
      admin,
      "post",
      `${API}/users/${targetId}/two-step/reset`,
    );
    expect(res.status).toBe(403);
    expect(errorCodeOf(res)).toBe("CSRF_INVALID");
  });
});
