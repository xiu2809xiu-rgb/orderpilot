import { twoStepVerifyResponseSchema } from "@orderpilot/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import { emailForRole } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  codeAt,
  enableTwoStep,
  errorCodeOf,
  startChallenge,
  verifyWith,
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
});
