import { COOKIES, twoStepVerifyResponseSchema } from "@orderpilot/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { hashChallengeToken } from "../../src/two-step/domain/challenge-token.js";
import { SecretBox, deriveKey } from "../../src/two-step/domain/secret-box.js";
import { TwoStepChallengeRepository } from "../../src/two-step/two-step-challenge.repository.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  browserFrom,
  call,
  demoSignIn,
  emailForRole,
  parseSetCookie,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  VERIFY_PATH,
  challengeTokenOf,
  codeAt,
  enableTwoStep,
  errorCodeOf,
  passwordLogin,
  startChallenge,
  verifyWith,
  wrongCodeAt,
  wrongTries,
  type TwoStepAccount,
} from "../support/two-step.js";

const MINUTE = 60_000;
const FIFTEEN_MINUTES = 15 * MINUTE;

function setCookieLines(res: request.Response): string[] {
  return (res.headers["set-cookie"] ?? []) as unknown as string[];
}

describe("two-step sign-in", () => {
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
    email = await emailForRole("SUPPORT");
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(async () => {
    clock.set(FIXED_NOW);
    account = await enableTwoStep(t, email);
  });

  async function twoStepEvents(action: string) {
    return (await auditEvents(t)).filter((e) => e.action === action);
  }

  it("gives no session cookie after a right password when two-step is on", async () => {
    const res = await passwordLogin(t, email);

    expect(res.status).toBe(401);
    expect(errorCodeOf(res)).toBe("TWO_STEP_REQUIRED");
    expect(
      (res.body as { error: { details: unknown } }).error.details,
    ).toBeNull();
    const jar = parseSetCookie(res.headers["set-cookie"]);
    expect(Object.keys(jar)).toEqual([COOKIES.twoStep]);
    expect(jar[COOKIES.twoStep]?.length).toBeGreaterThan(20);
    const me = await request(t.app.getHttpServer()).get(`${API}/auth/me`);
    expect(me.status).toBe(401);
  });

  it("keeps the wrong-password answer for an account with two-step on", async () => {
    const wrong = await passwordLogin(t, email, "not-the-password");
    const plain = await passwordLogin(
      t,
      await emailForRole("WAREHOUSE"),
      "not-the-password",
    );

    expect(wrong.status).toBe(401);
    expect(errorCodeOf(wrong)).toBe("INVALID_CREDENTIALS");
    expect(wrong.headers["set-cookie"]).toBeUndefined();
    expect({ ...wrong.body.error, traceId: "" }).toEqual({
      ...plain.body.error,
      traceId: "",
    });
  });

  it("gives a session after a right code and clears the challenge cookie", async () => {
    const token = await startChallenge(t, email);

    const res = await verifyWith(t, token, {
      code: codeAt(account.secret, FIXED_NOW),
    });

    expect(res.status).toBe(200);
    const parsed = twoStepVerifyResponseSchema.parse(res.body);
    expect(parsed.data.user.email).toBe(email);
    expect(parsed.meta).toEqual({
      method: "code",
      recoveryCodesLeft: 10,
      lockedRecently: false,
    });
    expect(res.headers["cache-control"]).toBe("no-store");
    const lines = setCookieLines(res);
    for (const name of [COOKIES.access, COOKIES.refresh, COOKIES.csrf]) {
      expect(
        lines.some(
          (l) => l.startsWith(`${name}=`) && !l.startsWith(`${name}=;`),
        ),
      ).toBe(true);
    }
    const cleared = lines.find((l) => l.startsWith(`${COOKIES.twoStep}=;`));
    expect(cleared).toContain(`Path=${API}/auth/two-step/verify`);
    const signedIn = parseSetCookie(res.headers["set-cookie"]);
    const me = await request(t.app.getHttpServer())
      .get(`${API}/auth/me`)
      .set("Cookie", `${COOKIES.access}=${signedIn[COOKIES.access] ?? ""}`);
    expect(me.status).toBe(200);
    const logins = await twoStepEvents("auth.login");
    expect(logins.at(-1)?.changes).toEqual({
      demo: false,
      secondStep: "code",
    });
  });

  it("sets the challenge cookie httpOnly, Strict, on the verify path only, for five minutes", async () => {
    const res = await passwordLogin(t, email);

    const line =
      setCookieLines(res).find((l) => l.startsWith(`${COOKIES.twoStep}=`)) ??
      "";
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Strict/i);
    expect(line).toContain(`Path=${API}/auth/two-step/verify;`);
    expect(line).toContain("Max-Age=300");
  });

  it("stores only a hash of the challenge token", async () => {
    const token = await startChallenge(t, email);

    const challenges = t.app.get(TwoStepChallengeRepository);
    expect(
      await challenges.findByHash(hashChallengeToken(token)),
    ).not.toBeNull();
    expect(await challenges.findByHash(token)).toBeNull();
  });

  it("refuses a code used a second time", async () => {
    const code = codeAt(account.secret, FIXED_NOW);
    const first = await verifyWith(t, await startChallenge(t, email), { code });
    expect(first.status).toBe(200);

    const second = await verifyWith(t, await startChallenge(t, email), {
      code,
    });

    expect(second.status).toBe(422);
    expect(errorCodeOf(second)).toBe("TWO_STEP_CODE_INVALID");
    const refusals = await twoStepEvents("auth.two-step.refused");
    expect(refusals.at(-1)?.changes).toMatchObject({
      reason: "replayed-code",
      via: "sign-in",
    });
  });

  it("accepts one step either side of the clock and refuses two away", async () => {
    for (const offset of [-1, 0, 1]) {
      account = await enableTwoStep(t, email);
      const res = await verifyWith(t, await startChallenge(t, email), {
        code: codeAt(account.secret, FIXED_NOW, offset),
      });
      expect(res.status, `offset ${String(offset)}`).toBe(200);
    }
    for (const offset of [-2, 2]) {
      account = await enableTwoStep(t, email);
      const res = await verifyWith(t, await startChallenge(t, email), {
        code: codeAt(account.secret, FIXED_NOW, offset),
      });
      expect(res.status, `offset ${String(offset)}`).toBe(422);
    }
  });

  it("answers the first four wrong codes with 422 and the fifth with 401 TWO_STEP_CHALLENGE_ENDED and a cleared challenge cookie", async () => {
    const token = await startChallenge(t, email);

    const answers = await wrongTries(t, token, account, FIXED_NOW, 5);

    expect(answers.slice(0, 4).map((r) => r.status)).toEqual([
      422, 422, 422, 422,
    ]);
    expect(answers.slice(0, 4).map(errorCodeOf)).toEqual(
      Array.from({ length: 4 }, () => "TWO_STEP_CODE_INVALID"),
    );
    const fifth = answers.slice(4)[0];
    expect(fifth?.status).toBe(401);
    expect(fifth ? errorCodeOf(fifth) : "").toBe("TWO_STEP_CHALLENGE_ENDED");
    expect(fifth ? setCookieLines(fifth) : []).toEqual(
      expect.arrayContaining([expect.stringMatching(/^op_two_step=;/)]),
    );
    // The right code no longer works on that challenge: it is gone.
    const late = await verifyWith(t, token, {
      code: codeAt(account.secret, FIXED_NOW),
    });
    expect(late.status).toBe(401);
    expect(errorCodeOf(late)).toBe("TWO_STEP_CHALLENGE_ENDED");
    const refusals = await twoStepEvents("auth.two-step.refused");
    expect(
      refusals.some(
        (e) =>
          (e.changes as { reason?: string } | null)?.reason ===
          "too-many-tries",
      ),
    ).toBe(true);
  });

  it("ends a challenge after five minutes", async () => {
    const token = await startChallenge(t, email);
    clock.advance(5 * MINUTE);

    const res = await verifyWith(t, token, {
      code: codeAt(account.secret, clock.now()),
    });

    expect(res.status).toBe(401);
    expect(errorCodeOf(res)).toBe("TWO_STEP_CHALLENGE_ENDED");
    expect(
      (await twoStepEvents("auth.two-step.refused")).at(-1)?.changes,
    ).toMatchObject({
      reason: "expired-challenge",
    });
  });

  it("ends a challenge for a user disabled since", async () => {
    const token = await startChallenge(t, email);
    const users = t.app.get(UserRepository);
    await users.setDisabledAt(account.userId, FIXED_NOW);
    try {
      const res = await verifyWith(t, token, {
        code: codeAt(account.secret, FIXED_NOW),
      });

      expect(res.status).toBe(401);
      expect(errorCodeOf(res)).toBe("TWO_STEP_CHALLENGE_ENDED");
      expect(
        (await twoStepEvents("auth.two-step.refused")).at(-1)?.changes,
      ).toMatchObject({
        reason: "user-disabled",
      });
    } finally {
      await users.setDisabledAt(account.userId, null);
    }
  });

  it("ends a challenge when two-step was turned off meanwhile", async () => {
    const token = await startChallenge(t, email);
    await t.app.get(TwoStepRepository).deleteForUser(account.userId);

    const res = await verifyWith(t, token, {
      code: codeAt(account.secret, FIXED_NOW),
    });

    expect(res.status).toBe(401);
    expect(errorCodeOf(res)).toBe("TWO_STEP_CHALLENGE_ENDED");
  });

  it("lets a recovery code in once and says how many are left", async () => {
    const written = account.recoveryCodes[0] ?? "";
    const typed = written.toLowerCase().replaceAll("-", " ");

    const res = await verifyWith(t, await startChallenge(t, email), {
      recoveryCode: typed,
    });

    expect(res.status).toBe(200);
    expect(twoStepVerifyResponseSchema.parse(res.body).meta).toMatchObject({
      method: "recovery-code",
      recoveryCodesLeft: 9,
    });
    const used = await twoStepEvents("auth.two-step.recovery-code-used");
    expect(used.at(-1)?.changes).toEqual({ left: 9 });
    expect((await twoStepEvents("auth.login")).at(-1)?.changes).toEqual({
      demo: false,
      secondStep: "recovery-code",
    });
    const again = await verifyWith(t, await startChallenge(t, email), {
      recoveryCode: written,
    });
    expect(again.status).toBe(422);
    expect(errorCodeOf(again)).toBe("TWO_STEP_CODE_INVALID");
    expect(
      (await twoStepEvents("auth.two-step.refused")).at(-1)?.changes,
    ).toMatchObject({
      reason: "wrong-recovery-code",
    });
  });

  it("lets the demo sign-in through for an account with two-step on", async () => {
    const browser = await demoSignIn(t, "SUPPORT");

    expect(browser.session.user.email).toBe(email);
    const me = await call(t, browser, "get", `${API}/auth/me`);
    expect(me.status).toBe(200);
  });

  it("does not ask for a second step while a setup is only pending", async () => {
    const user = await t.app.get(UserRepository).findByEmail(email);
    const secrets = t.app.get(TwoStepRepository);
    await secrets.deleteForUser(user?.id ?? "");
    await secrets.startSetup(user?.id ?? "", "pending-cipher", FIXED_NOW);

    const res = await passwordLogin(t, email);

    expect(res.status).toBe(200);
    expect(Object.keys(parseSetCookie(res.headers["set-cookie"]))).toContain(
      COOKIES.access,
    );
  });

  it("refuses a form post and a foreign origin on verify", async () => {
    const token = await startChallenge(t, email);
    const form = await request(t.app.getHttpServer())
      .post(VERIFY_PATH)
      .set("Cookie", `${COOKIES.twoStep}=${token}`)
      .type("form")
      .send("code=123456");
    const foreign = await request(t.app.getHttpServer())
      .post(VERIFY_PATH)
      .set("Cookie", `${COOKIES.twoStep}=${token}`)
      .set("Origin", "https://evil.example")
      .send({ code: codeAt(account.secret, FIXED_NOW) });

    expect(form.status).toBe(403);
    expect(errorCodeOf(form)).toBe("CSRF_INVALID");
    expect(foreign.status).toBe(403);
    expect(errorCodeOf(foreign)).toBe("CSRF_INVALID");
    expect(foreign.headers["set-cookie"]).toBeUndefined();
    const refused = await twoStepEvents("auth.csrf.refused");
    expect(refused.length).toBeGreaterThan(0);
    // The challenge is untouched and still works from the right origin.
    const ok = await verifyWith(t, token, {
      code: codeAt(account.secret, FIXED_NOW),
    });
    expect(ok.status).toBe(200);
  });

  it("validates the body: exactly one of code and recovery code, six digits", async () => {
    const token = await startChallenge(t, email);
    for (const body of [
      {},
      { code: "12345" },
      { code: "123456", recoveryCode: "ABCDE-FGHJK-LMNPQ" },
    ]) {
      const res = await verifyWith(t, token, body);
      expect(res.status).toBe(400);
      expect(errorCodeOf(res)).toBe("VALIDATION_FAILED");
    }
  });

  it("audits every refusal with its reason in changes.reason and never a code", async () => {
    const token = await startChallenge(t, email);
    const wrong = wrongCodeAt(account.secret, FIXED_NOW);
    await verifyWith(t, token, { code: wrong });
    await verifyWith(t, token, { recoveryCode: "ZZZZZ-ZZZZZ-ZZZZZ" });
    await verifyWith(t, token, { code: codeAt(account.secret, FIXED_NOW) });

    const events = await auditEvents(t);
    const refusals = events.filter((e) => e.action === "auth.two-step.refused");
    expect(refusals.length).toBeGreaterThanOrEqual(2);
    for (const event of refusals) {
      const changes = event.changes as {
        reason?: unknown;
        via?: unknown;
      } | null;
      expect(typeof changes?.reason).toBe("string");
      expect(changes?.via).toBe("sign-in");
    }
    const everything = JSON.stringify(events);
    expect(everything).not.toContain(wrong);
    expect(everything).not.toContain(codeAt(account.secret, FIXED_NOW));
    expect(everything).not.toContain(token);
  });

  it("gives every refusal the same fixed summary whatever the reason, with no reason word in it", async () => {
    const token = await startChallenge(t, email);
    await verifyWith(t, token, {
      code: wrongCodeAt(account.secret, FIXED_NOW),
    });
    await verifyWith(t, token, { recoveryCode: "ZZZZZ-ZZZZZ-ZZZZZ" });
    clock.advance(6 * MINUTE);
    await verifyWith(t, token, { code: codeAt(account.secret, clock.now()) });

    const refusals = await twoStepEvents("auth.two-step.refused");
    const reasons = new Set(
      refusals.map((e) => (e.changes as { reason: string }).reason),
    );
    expect(reasons.size).toBeGreaterThanOrEqual(3);
    for (const event of refusals) {
      expect(event.summary).toBe("A two-step sign-in step was refused");
      for (const reason of reasons) expect(event.summary).not.toContain(reason);
    }
  });

  it("answers the same wrong code that is also the tenth in 15 minutes with ENDED and stores the lock", async () => {
    // Challenge one takes five wrong codes (ended). Challenge two takes four,
    // so its fifth is also the tenth wrong code of the person.
    const first = await startChallenge(t, email);
    await wrongTries(t, first, account, FIXED_NOW, 5);
    const second = await startChallenge(t, email);
    await wrongTries(t, second, account, FIXED_NOW, 4);

    const tenth = (await wrongTries(t, second, account, FIXED_NOW, 1))[0];

    expect(tenth?.status).toBe(401);
    expect(tenth ? errorCodeOf(tenth) : "").toBe("TWO_STEP_CHALLENGE_ENDED");
    const state = await t.app.get(TwoStepRepository).stateOf(account.userId);
    expect(state?.lockedUntil).toEqual(
      new Date(FIXED_NOW.getTime() + FIFTEEN_MINUTES),
    );
    const reasons = (await twoStepEvents("auth.two-step.refused")).map(
      (e) => (e.changes as { reason: string }).reason,
    );
    expect(reasons).toContain("locked-now");
    expect(reasons).toContain("too-many-tries");
  });
});

describe("two-step sign-in, anonymous refusals", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("refuses a challenge token that does not exist, and audits it once a minute", async () => {
    const made = Buffer.alloc(32, 7).toString("base64url");
    const unknown = await verifyWith(t, made, { code: "123456" });
    const none = await verifyWith(t, null, { code: "123456" });

    for (const res of [unknown, none]) {
      expect(res.status).toBe(401);
      expect(errorCodeOf(res)).toBe("TWO_STEP_CHALLENGE_ENDED");
    }
    const rows = (await auditEvents(t)).filter(
      (e) => e.action === "auth.two-step.refused",
    );
    // Anyone can cause these with no password, so only one row is written.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe("ApiRoute");
    expect(rows[0]?.changes).toMatchObject({ reason: "unknown-challenge" });
  });
});

describe("two-step sign-in, a secret that cannot be opened", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    // The app's box has another key than the one the row was sealed under, as
    // after JWT_SECRET was changed.
    t = await createTestApp({}, [], (b) =>
      b
        .overrideProvider(Clock)
        .useValue(new TestClock())
        .overrideProvider(SecretBox)
        .useValue(
          new SecretBox(deriveKey("another-secret-another-secret-123456")),
        ),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  it("refuses codes but lets a recovery code sign in", async () => {
    const email = await emailForRole("FINANCE");
    const account = await enableTwoStep(t, email, {
      box: new SecretBox(deriveKey(t.config.auth.jwtSecret)),
    });
    const token = await startChallenge(t, email);

    const code = await verifyWith(t, token, {
      code: codeAt(account.secret, FIXED_NOW),
    });
    expect(code.status).toBe(422);
    expect(errorCodeOf(code)).toBe("TWO_STEP_CODE_INVALID");
    const refused = (await auditEvents(t)).filter(
      (e) => e.action === "auth.two-step.refused",
    );
    expect(refused.at(-1)?.changes).toMatchObject({
      reason: "secret-unreadable",
    });

    const recovery = await verifyWith(t, token, {
      recoveryCode: account.recoveryCodes[0],
    });
    expect(recovery.status).toBe(200);
    // And it can turn two-step off with another recovery code, then start again.
    const browser = browserFrom(
      twoStepVerifyResponseSchema.parse(recovery.body).data,
      recovery.headers["set-cookie"],
    );
    const off = await call(t, browser, "post", `${API}/auth/two-step/disable`, {
      csrf: true,
      body: {
        password: TEST_DEMO_PASSWORD,
        recoveryCode: account.recoveryCodes[1],
      },
    });
    expect(off.status).toBe(200);
    expect((await passwordLogin(t, email)).status).toBe(200);
  });
});

describe("password login of an account with no two-step", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("signs in as it did before", async () => {
    const res = await request(t.app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({
        email: await emailForRole("AUDITOR"),
        password: TEST_DEMO_PASSWORD,
      });
    expect(res.status).toBe(200);
    expect(challengeTokenOf(res)).toBeNull();
  });
});
