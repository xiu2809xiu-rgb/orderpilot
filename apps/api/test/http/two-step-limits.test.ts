import {
  twoStepSetupResponseSchema,
  twoStepStatusResponseSchema,
  twoStepVerifyResponseSchema,
} from "@orderpilot/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { decodeBase32 } from "../../src/two-step/domain/base32.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  emailForRole,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  clearTwoStep,
  codeAt,
  enableTwoStep,
  errorCodeOf,
  startChallenge,
  verifyWith,
  wrongCodeAt,
  wrongTries,
  type TwoStepAccount,
} from "../support/two-step.js";

const SECOND = 1000;
const DAY = 86_400 * SECOND;

describe("two-step limits", () => {
  let t: TestApp;
  let clock: TestClock;
  let email: string;
  let account: TwoStepAccount;

  beforeAll(async () => {
    await resetTestData();
    clock = new TestClock();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(clock),
    );
    email = await emailForRole("PRODUCT_MANAGER");
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    clock.set(FIXED_NOW);
    account = await enableTwoStep(t, email);
  });

  /** Ten wrong codes over two challenges: five each, so each challenge ends. */
  async function lockOut(): Promise<void> {
    for (let round = 0; round < 2; round += 1) {
      const token = await startChallenge(t, email);
      await wrongTries(t, token, account, clock.now(), 5);
    }
  }

  const stateOfAccount = () =>
    t.app.get(TwoStepRepository).stateOf(account.userId);

  it("locks the code entry after ten wrong codes in 15 minutes, across challenges", async () => {
    await lockOut();

    const token = await startChallenge(t, email);
    const res = await verifyWith(t, token, {
      code: codeAt(account.secret, clock.now()),
    });

    expect(res.status).toBe(429);
    expect(errorCodeOf(res)).toBe("TWO_STEP_LOCKED");
    expect(res.headers["set-cookie"]).toBeUndefined();
    const state = await stateOfAccount();
    expect(state?.lockedUntil).toEqual(
      new Date(FIXED_NOW.getTime() + 900 * SECOND),
    );
  });

  it("still takes a recovery code while locked", async () => {
    await lockOut();

    const res = await verifyWith(t, await startChallenge(t, email), {
      recoveryCode: account.recoveryCodes[0],
    });

    expect(res.status).toBe(200);
    const state = await stateOfAccount();
    expect(state?.lockedUntil).toBeNull();
    expect(state?.locksInARow).toBe(0);
  });

  it("makes the third lock in a row last 24 hours", async () => {
    await lockOut();
    clock.advance(901 * SECOND);
    await lockOut();
    clock.advance(901 * SECOND);
    expect((await stateOfAccount())?.locksInARow).toBe(2);
    await lockOut();

    const res = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe(String(86_400));
    const state = await stateOfAccount();
    expect(state?.locksInARow).toBe(3);
    expect(state?.lockedUntil).toEqual(new Date(clock.now().getTime() + DAY));
  });

  it("unlocks after the lock and counts again", async () => {
    await lockOut();
    clock.advance(901 * SECOND);
    const [wrong] = await wrongTries(
      t,
      await startChallenge(t, email),
      account,
      clock.now(),
      1,
    );
    expect(wrong?.status).toBe(422);
    expect((await stateOfAccount())?.failedAt).toHaveLength(1);

    const res = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });

    expect(res.status).toBe(200);
  });

  it("clears the count after a success", async () => {
    await lockOut();
    clock.advance(901 * SECOND);
    const res = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });
    expect(res.status).toBe(200);

    const state = await stateOfAccount();

    expect(state).toMatchObject({
      locksInARow: 0,
      lockedUntil: null,
      failedAt: [],
    });
    // The last lock stays on record, so its owner can still be told of it.
    expect(state?.lastLockedAt).toEqual(FIXED_NOW);
  });

  it("sends Retry-After in whole seconds and no details on every lock answer", async () => {
    await lockOut();
    clock.advance(100_500);

    const res = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });

    expect(res.status).toBe(429);
    // 900 s lock, 100.5 s gone: 799.5 s left, rounded up.
    expect(res.headers["retry-after"]).toBe("800");
    expect(
      (res.body as { error: { details: unknown } }).error.details,
    ).toBeNull();
  });

  it("tells the owner of a lock that a success did not clear", async () => {
    await lockOut();
    const recovery = await verifyWith(t, await startChallenge(t, email), {
      recoveryCode: account.recoveryCodes[0],
    });
    expect(
      twoStepVerifyResponseSchema.parse(recovery.body).meta.lockedRecently,
    ).toBe(true);

    const later = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });
    expect(
      twoStepVerifyResponseSchema.parse(later.body).meta.lockedRecently,
    ).toBe(true);

    clock.advance(7 * DAY);
    const afterWeek = await verifyWith(t, await startChallenge(t, email), {
      code: codeAt(account.secret, clock.now()),
    });
    expect(afterWeek.status).toBe(200);
    expect(
      twoStepVerifyResponseSchema.parse(afterWeek.body).meta.lockedRecently,
    ).toBe(false);
  });

  it("gives the same count to the settings routes", async () => {
    // Five wrong codes at sign-in, five more at the turn-off route: ten in all.
    await wrongTries(
      t,
      await startChallenge(t, email),
      account,
      clock.now(),
      5,
    );
    const demo = await demoSignIn(t, "PRODUCT_MANAGER");
    const disable = (body: object) =>
      call(t, demo, "post", `${API}/auth/two-step/disable`, {
        csrf: true,
        body,
      });
    for (let n = 0; n < 5; n += 1) {
      const wrong = await disable({
        code: wrongCodeAt(account.secret, clock.now()),
      });
      expect(wrong.status).toBe(422);
    }

    const right = codeAt(account.secret, clock.now());
    const atSignIn = await verifyWith(t, await startChallenge(t, email), {
      code: right,
    });
    const atDisable = await disable({ code: right });
    const atNewCodes = await call(
      t,
      demo,
      "post",
      `${API}/auth/two-step/recovery-codes`,
      {
        csrf: true,
        body: { code: right },
      },
    );

    for (const res of [atSignIn, atDisable, atNewCodes]) {
      expect(res.status).toBe(429);
      expect(errorCodeOf(res)).toBe("TWO_STEP_LOCKED");
      expect(res.headers["retry-after"]).toBe("900");
      expect(
        (res.body as { error: { details: unknown } }).error.details,
      ).toBeNull();
    }
    expect((await stateOfAccount())?.lockedUntil).not.toBeNull();
  });

  it("counts wrong confirm codes toward the lock", async () => {
    const other = await emailForRole("WAREHOUSE");
    await clearTwoStep(t, other);
    const demo = await demoSignIn(t, "WAREHOUSE");
    const setup = await call(t, demo, "post", `${API}/auth/two-step/setup`, {
      csrf: true,
      body: {},
    });
    expect(setup.status).toBe(200);
    const pending =
      decodeBase32(
        twoStepSetupResponseSchema.parse(setup.body).data.setupKey,
      ) ?? Buffer.alloc(0);
    const enable = (code: string) =>
      call(t, demo, "post", `${API}/auth/two-step/enable`, {
        csrf: true,
        body: { code },
      });
    for (let n = 0; n < 10; n += 1) {
      expect((await enable(wrongCodeAt(pending, clock.now()))).status).toBe(
        422,
      );
    }

    const locked = await enable("123456");

    expect(locked.status).toBe(429);
    expect(locked.headers["retry-after"]).toBe("900");
    await clearTwoStep(t, other);
  });

  it("shows the owner a recent lock in the status for seven days", async () => {
    await lockOut();
    const demo = await demoSignIn(t, "PRODUCT_MANAGER");
    const read = async () =>
      twoStepStatusResponseSchema.parse(
        (await call(t, demo, "get", `${API}/auth/two-step`)).body,
      ).data;

    expect((await read()).lastLockedAt).toBe(FIXED_NOW.toISOString());
    clock.advance(7 * DAY);
    expect((await read()).lastLockedAt).toBeNull();
  });
});

describe("two-step limits, the sampling of refusals", () => {
  let t: TestApp;
  let email: string;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(new TestClock()),
    );
    email = await emailForRole("FINANCE");
  });
  afterAll(async () => {
    await t.close();
  });

  it("keeps an anonymous refusal from hiding a known account's still-locked, and writes that one once a minute", async () => {
    const account = await enableTwoStep(t, email);
    for (let round = 0; round < 2; round += 1) {
      const token = await startChallenge(t, email);
      await wrongTries(t, token, account, FIXED_NOW, 5);
    }
    const token = await startChallenge(t, email);
    const right = { code: codeAt(account.secret, FIXED_NOW) };

    // One address, one minute: an anonymous post first, then two refusals of
    // the locked account.
    await verifyWith(t, null, right);
    await verifyWith(t, token, right);
    await verifyWith(t, token, right);

    const reasons = (await auditEvents(t))
      .filter((e) => e.action === "auth.two-step.refused")
      .map((e) => (e.changes as { reason: string }).reason)
      .filter((reason) => ["no-challenge", "still-locked"].includes(reason));
    expect(reasons.sort()).toEqual(["no-challenge", "still-locked"]);
  });
});
