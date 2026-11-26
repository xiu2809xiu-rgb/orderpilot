import {
  recoveryCodesResponseSchema,
  twoStepSetupResponseSchema,
  twoStepStatusResponseSchema,
  type TwoStepStatus,
} from "@orderpilot/shared";
import pg from "pg";
import type request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RefreshTokenRepository } from "../../src/sessions/refresh-token.repository.js";
import { UserRepository } from "../../src/users/user.repository.js";
import { Clock } from "../../src/common/clock.js";
import { runSeed } from "../../src/database/seed/run-seed.js";
import { decodeBase32 } from "../../src/two-step/domain/base32.js";
import { RecoveryCodeRepository } from "../../src/two-step/recovery-code.repository.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
  passwordSignIn,
  TEST_DEMO_PASSWORD,
  type Browser,
} from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  clearTwoStep,
  codeAt,
  enableTwoStep,
  errorCodeOf,
  passwordLogin,
  wrongCodeAt,
} from "../support/two-step.js";

const BASE = `${API}/auth/two-step`;
const RECOVERY_SHAPE =
  /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;
const MINUTE = 60_000;

describe("two-step settings", () => {
  let t: TestApp;
  let clock: TestClock;
  let email: string;

  beforeAll(async () => {
    await resetTestData();
    clock = new TestClock();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(clock),
    );
    email = await emailForRole("SUPPORT");
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    clock.set(FIXED_NOW);
    await clearTwoStep(t, email);
    // Earlier tests left password sign-ins of this account behind: count none of them.
    const user = await t.app.get(UserRepository).findByEmail(email);
    await t.app
      .get(RefreshTokenRepository)
      .revokeAllForUser(user?.id ?? "", "test-cleanup", FIXED_NOW);
  });

  const post = (browser: Browser, path: string, body: object = {}) =>
    call(t, browser, "post", `${BASE}${path}`, { csrf: true, body });
  const statusOf = async (browser: Browser): Promise<TwoStepStatus> =>
    twoStepStatusResponseSchema.parse(
      (await call(t, browser, "get", BASE)).body,
    ).data;
  const events = async (action: string) =>
    (await auditEvents(t)).filter((e) => e.action === action);
  const lastRefusal = async () =>
    (await events("auth.two-step.refused")).at(-1)?.changes;

  /** Setup, then the first right code. Returns the secret and the ten codes. */
  async function turnOn(browser: Browser, password?: string) {
    const setup = await post(browser, "/setup", password ? { password } : {});
    expect(setup.status).toBe(200);
    const { setupKey } = twoStepSetupResponseSchema.parse(setup.body).data;
    const secret = decodeBase32(setupKey) ?? Buffer.alloc(0);
    const enable = await post(browser, "/enable", {
      code: codeAt(secret, clock.now()),
    });
    expect(enable.status).toBe(200);
    const { recoveryCodes } = recoveryCodesResponseSchema.parse(
      enable.body,
    ).data;
    return { secret, recoveryCodes, setupKey };
  }

  it("reads the state as off, then on", async () => {
    const browser = await passwordSignIn(t, email);
    expect(await statusOf(browser)).toEqual({
      state: "off",
      hasPassword: true,
      demoSignInSkips: true,
      demoAdminBlocked: false,
      enabledAt: null,
      recoveryCodesLeft: null,
      lastLockedAt: null,
    });

    await post(browser, "/setup", { password: TEST_DEMO_PASSWORD });
    expect((await statusOf(browser)).state).toBe("off");

    const { secret } = await turnOn(browser, TEST_DEMO_PASSWORD);
    expect(secret).toHaveLength(20);
    expect(await statusOf(browser)).toMatchObject({
      state: "on",
      enabledAt: FIXED_NOW.toISOString(),
      recoveryCodesLeft: 10,
    });
  });

  it("refuses setup with no password or a wrong one for a password session", async () => {
    const browser = await passwordSignIn(t, email);

    const none = await post(browser, "/setup", {});
    const wrong = await post(browser, "/setup", {
      password: "not-the-password",
    });

    expect(none.status).toBe(400);
    expect(errorCodeOf(none)).toBe("VALIDATION_FAILED");
    expect(none.body.error.details).toEqual([
      { path: "password", message: "Enter your password." },
    ]);
    expect(wrong.status).toBe(422);
    expect(errorCodeOf(wrong)).toBe("PASSWORD_INCORRECT");
    expect(await lastRefusal()).toEqual({
      reason: "wrong-password",
      via: "setup",
    });
    const state = await t.app
      .get(TwoStepRepository)
      .stateOf(browser.session.user.id);
    expect(state).toBeNull();
  });

  it("starts setup with no password for a demo session", async () => {
    const browser = await demoSignIn(t, "SUPPORT");

    const res = await post(browser, "/setup", {});

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const data = twoStepSetupResponseSchema.parse(res.body).data;
    expect(data.expiresAt).toBe(
      new Date(FIXED_NOW.getTime() + 10 * MINUTE).toISOString(),
    );
    expect(data.otpauthUri).toContain(encodeURIComponent(email));
    expect(data.otpauthUri).toContain(`secret=${data.setupKey}`);
  });

  it("refuses a demo session setup for an account whose role holds users.manage, with 409 and an audited refusal, and still lets the demo Management session through", async () => {
    const admin = await demoSignIn(t, "SYSTEM_ADMIN");
    const adminEmail = await emailForRole("SYSTEM_ADMIN");
    await clearTwoStep(t, adminEmail);

    expect((await statusOf(admin)).demoAdminBlocked).toBe(true);
    const refused = await post(admin, "/setup", {});

    expect(refused.status).toBe(409);
    expect(errorCodeOf(refused)).toBe("CONFLICT");
    expect(await lastRefusal()).toEqual({
      reason: "demo-administrator",
      via: "setup",
    });
    expect(
      await t.app.get(TwoStepRepository).stateOf(admin.session.user.id),
    ).toBeNull();

    const management = await demoSignIn(t, "MANAGEMENT");
    expect((await statusOf(management)).demoAdminBlocked).toBe(false);
    expect((await post(management, "/setup", {})).status).toBe(200);
    await clearTwoStep(t, await emailForRole("MANAGEMENT"));
  });

  it("still lets a password session of the System admin turn two-step on", async () => {
    const adminEmail = await emailForRole("SYSTEM_ADMIN");
    await clearTwoStep(t, adminEmail);
    const browser = await passwordSignIn(t, adminEmail);

    const res = await post(browser, "/setup", { password: TEST_DEMO_PASSWORD });

    expect(res.status).toBe(200);
    await clearTwoStep(t, adminEmail);
  });

  it("turns on with the first right code and shows ten recovery codes once", async () => {
    const browser = await passwordSignIn(t, email);
    const secretKey = twoStepSetupResponseSchema.parse(
      (await post(browser, "/setup", { password: TEST_DEMO_PASSWORD })).body,
    ).data.setupKey;
    const secret = decodeBase32(secretKey) ?? Buffer.alloc(0);

    const wrong = await post(browser, "/enable", {
      code: wrongCodeAt(secret, FIXED_NOW),
    });
    expect(wrong.status).toBe(422);
    expect(errorCodeOf(wrong)).toBe("TWO_STEP_CODE_INVALID");
    expect((await statusOf(browser)).state).toBe("off");

    const res = await post(browser, "/enable", {
      code: codeAt(secret, FIXED_NOW),
    });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const { recoveryCodes, status } = recoveryCodesResponseSchema.parse(
      res.body,
    ).data;
    expect(new Set(recoveryCodes).size).toBe(10);
    for (const code of recoveryCodes) expect(code).toMatch(RECOVERY_SHAPE);
    expect(status.state).toBe("on");
    const enabled = (await events("auth.two-step.enabled")).at(-1);
    expect(enabled?.changes).toEqual({
      recoveryCodes: 10,
      otherSessionsEnded: 0,
    });
    // From now on a password sign-in stops at the second step.
    const login = await passwordLogin(t, email);
    expect(login.status).toBe(401);
    expect(errorCodeOf(login)).toBe("TWO_STEP_REQUIRED");
  });

  it("refuses to confirm after ten minutes, and when nothing was started", async () => {
    const browser = await passwordSignIn(t, email);
    const none = await post(browser, "/enable", { code: "123456" });
    expect(none.status).toBe(409);
    expect(errorCodeOf(none)).toBe("TWO_STEP_SETUP_ENDED");

    const setup = await post(browser, "/setup", {
      password: TEST_DEMO_PASSWORD,
    });
    const secret =
      decodeBase32(
        twoStepSetupResponseSchema.parse(setup.body).data.setupKey,
      ) ?? Buffer.alloc(0);
    clock.advance(10 * MINUTE);

    const late = await post(browser, "/enable", {
      code: codeAt(secret, clock.now()),
    });

    expect(late.status).toBe(409);
    expect(errorCodeOf(late)).toBe("TWO_STEP_SETUP_ENDED");
    expect(await lastRefusal()).toEqual({
      reason: "setup-ended",
      via: "enable",
    });
    expect((await statusOf(browser)).state).toBe("off");
  });

  it("keeps the failure list when setup restarts", async () => {
    const browser = await passwordSignIn(t, email);
    const setup = await post(browser, "/setup", {
      password: TEST_DEMO_PASSWORD,
    });
    const secret =
      decodeBase32(
        twoStepSetupResponseSchema.parse(setup.body).data.setupKey,
      ) ?? Buffer.alloc(0);
    for (let n = 0; n < 3; n += 1) {
      await post(browser, "/enable", { code: wrongCodeAt(secret, FIXED_NOW) });
    }
    const secrets = t.app.get(TwoStepRepository);
    const userId = browser.session.user.id;
    expect((await secrets.stateOf(userId))?.failedAt).toHaveLength(3);

    const again = await post(browser, "/setup", {
      password: TEST_DEMO_PASSWORD,
    });

    expect(again.status).toBe(200);
    expect(
      (await events("auth.two-step.setup-started")).at(-1)?.changes,
    ).toEqual({
      replacedPending: true,
    });
    expect((await secrets.stateOf(userId))?.failedAt).toHaveLength(3);
  });

  it("turning two-step on ends the other password sessions, not the current one and not demo ones", async () => {
    const current = await passwordSignIn(t, email);
    const other = await passwordSignIn(t, email);
    const demo = await demoSignIn(t, "SUPPORT");
    for (const browser of [current, other, demo]) {
      expect((await call(t, browser, "get", `${API}/auth/me`)).status).toBe(
        200,
      );
    }

    await turnOn(current, TEST_DEMO_PASSWORD);

    expect((await call(t, current, "get", `${API}/auth/me`)).status).toBe(200);
    expect((await call(t, demo, "get", `${API}/auth/me`)).status).toBe(200);
    expect((await call(t, other, "get", `${API}/auth/me`)).status).toBe(401);
    expect((await events("auth.two-step.enabled")).at(-1)?.changes).toEqual({
      recoveryCodes: 10,
      otherSessionsEnded: 1,
    });
  });

  it("refuses to turn off with the session cookie alone", async () => {
    const browser = await passwordSignIn(t, email);
    const { secret } = await turnOn(browser, TEST_DEMO_PASSWORD);
    const demo = await demoSignIn(t, "SUPPORT");

    const noProof = await post(browser, "/disable", {
      password: TEST_DEMO_PASSWORD,
    });
    const wrongCode = await post(browser, "/disable", {
      password: TEST_DEMO_PASSWORD,
      code: wrongCodeAt(secret, clock.now()),
    });
    const demoWrong = await post(demo, "/disable", {
      code: wrongCodeAt(secret, clock.now()),
    });

    expect(noProof.status).toBe(400);
    expect(wrongCode.status).toBe(422);
    expect(errorCodeOf(wrongCode)).toBe("TWO_STEP_CODE_INVALID");
    expect(demoWrong.status).toBe(422);
    expect((await statusOf(browser)).state).toBe("on");
  });

  it("needs the password of a password session to turn off", async () => {
    const browser = await passwordSignIn(t, email);
    const { secret } = await turnOn(browser, TEST_DEMO_PASSWORD);
    clock.advance(30_000);
    const code = codeAt(secret, clock.now());

    const none = await post(browser, "/disable", { code });
    const wrong = await post(browser, "/disable", { password: "nope", code });

    expect(none.status).toBe(400);
    expect(errorCodeOf(none)).toBe("VALIDATION_FAILED");
    expect(wrong.status).toBe(422);
    expect(errorCodeOf(wrong)).toBe("PASSWORD_INCORRECT");
    expect(await lastRefusal()).toEqual({
      reason: "wrong-password",
      via: "disable",
    });
    expect((await statusOf(browser)).state).toBe("on");
    // A wrong password costs no code attempt.
    const state = await t.app
      .get(TwoStepRepository)
      .stateOf(browser.session.user.id);
    expect(state?.failedAt).toEqual([]);
  });

  it("turns off with a recovery code", async () => {
    const browser = await passwordSignIn(t, email);
    const { recoveryCodes } = await turnOn(browser, TEST_DEMO_PASSWORD);

    const res = await post(browser, "/disable", {
      password: TEST_DEMO_PASSWORD,
      recoveryCode: recoveryCodes[0],
    });

    expect(res.status).toBe(200);
    expect(twoStepStatusResponseSchema.parse(res.body).data.state).toBe("off");
    expect((await events("auth.two-step.disabled")).at(-1)?.changes).toEqual({
      method: "recovery-code",
    });
    expect((await passwordLogin(t, email)).status).toBe(200);
    expect(
      await t.app
        .get(RecoveryCodeRepository)
        .countUnused(browser.session.user.id),
    ).toBe(0);
    expect(
      (
        await post(browser, "/disable", {
          password: TEST_DEMO_PASSWORD,
          recoveryCode: recoveryCodes[1],
        })
      ).status,
    ).toBe(409);
  });

  it("makes new recovery codes only with a current code and the old ones stop working", async () => {
    const browser = await passwordSignIn(t, email);
    const { secret, recoveryCodes } = await turnOn(browser, TEST_DEMO_PASSWORD);
    clock.advance(30_000);

    const recoveryInCode = await post(browser, "/recovery-codes", {
      recoveryCode: recoveryCodes[0],
    });
    const wrong = await post(browser, "/recovery-codes", {
      code: wrongCodeAt(secret, clock.now()),
    });
    const res = await post(browser, "/recovery-codes", {
      code: codeAt(secret, clock.now()),
    });

    expect(recoveryInCode.status).toBe(400);
    expect(wrong.status).toBe(422);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const fresh = recoveryCodesResponseSchema.parse(res.body).data
      .recoveryCodes;
    expect(fresh).toHaveLength(10);
    expect(fresh.filter((c) => recoveryCodes.includes(c))).toEqual([]);
    expect(
      (await events("auth.two-step.recovery-codes-replaced")).at(-1)?.changes,
    ).toEqual({ recoveryCodes: 10 });
    // The old codes do not sign in; a new one does.
    const challenge = await passwordLogin(t, email);
    const cookie = challenge.headers["set-cookie"] as unknown as string[];
    const token = /op_two_step=([^;]+)/.exec(cookie.join(";"))?.[1] ?? "";
    const verify = (
      recoveryCode: string | undefined,
    ): Promise<request.Response> =>
      Promise.resolve(
        call(t, null, "post", `${BASE}/verify`, { body: { recoveryCode } }).set(
          "Cookie",
          `op_two_step=${token}`,
        ),
      );
    expect((await verify(recoveryCodes[0])).status).toBe(422);
    expect((await verify(fresh[0])).status).toBe(200);
  });

  it("refuses a second setup and a second confirm while on", async () => {
    const browser = await passwordSignIn(t, email);
    const { secret } = await turnOn(browser, TEST_DEMO_PASSWORD);

    const setup = await post(browser, "/setup", {
      password: TEST_DEMO_PASSWORD,
    });
    expect(setup.status).toBe(409);
    expect(errorCodeOf(setup)).toBe("CONFLICT");
    expect(await lastRefusal()).toEqual({ reason: "already-on", via: "setup" });

    clock.advance(30_000);
    const enable = await post(browser, "/enable", {
      code: codeAt(secret, clock.now()),
    });
    expect(enable.status).toBe(409);
    expect(await lastRefusal()).toEqual({
      reason: "already-on",
      via: "enable",
    });
    expect(
      (
        await post(browser, "/disable", {
          password: TEST_DEMO_PASSWORD,
          code: "000000",
        })
      ).status,
    ).toBe(422);
  });

  it("leaves two-step alone when the seed runs again", async () => {
    const account = await enableTwoStep(t, email);

    await runSeed(testConfig());

    const state = await t.app.get(TwoStepRepository).stateOf(account.userId);
    expect(state?.status).toBe("ACTIVE");
    expect(
      await t.app.get(RecoveryCodeRepository).countUnused(account.userId),
    ).toBe(10);
  });

  it("answers 401 with no session on every settings route", async () => {
    for (const path of ["/setup", "/enable", "/disable", "/recovery-codes"]) {
      const res = await call(t, null, "post", `${BASE}${path}`, { body: {} });
      expect(res.status, path).toBe(401);
    }
    expect((await call(t, null, "get", BASE)).status).toBe(401);
  });

  it("refuses a settings change without the CSRF token", async () => {
    const browser = await passwordSignIn(t, email);
    const res = await call(t, browser, "post", `${BASE}/setup`, {
      body: { password: TEST_DEMO_PASSWORD },
    });
    expect(res.status).toBe(403);
    expect(errorCodeOf(res)).toBe("CSRF_INVALID");
  });
});

describe("two-step settings, an account with no password", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("refuses setup, audits it, and says so in the status", async () => {
    const client = new pg.Client({
      connectionString: testConfig().database.url,
    });
    await client.connect();
    try {
      await client.query(
        'UPDATE "User" SET "passwordHash" = NULL WHERE email = $1',
        [await emailForRole("LOGISTICS")],
      );
    } finally {
      await client.end();
    }
    const browser = await demoSignIn(t, "LOGISTICS");

    const status = twoStepStatusResponseSchema.parse(
      (await call(t, browser, "get", BASE)).body,
    ).data;
    const res = await call(t, browser, "post", `${BASE}/setup`, {
      csrf: true,
      body: {},
    });

    expect(status.hasPassword).toBe(false);
    expect(res.status).toBe(409);
    const refusals = (await auditEvents(t)).filter(
      (e) => e.action === "auth.two-step.refused",
    );
    expect(refusals.at(-1)?.changes).toEqual({
      reason: "no-password",
      via: "setup",
    });
  });
});
