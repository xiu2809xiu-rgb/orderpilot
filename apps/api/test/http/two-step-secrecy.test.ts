import {
  recoveryCodesResponseSchema,
  twoStepSetupResponseSchema,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import {
  decodeBase32,
  encodeBase32,
} from "../../src/two-step/domain/base32.js";
import { normaliseRecoveryCode } from "../../src/two-step/domain/recovery-codes.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  call,
  emailForRole,
  passwordSignIn,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  challengeTokenOf,
  codeAt,
  enableTwoStep,
  passwordLogin,
  startChallenge,
  verifyWith,
  wrongCodeAt,
} from "../support/two-step.js";

describe("two-step secrecy", () => {
  let t: TestApp;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(new TestClock()),
    );
  });
  afterAll(async () => {
    await t.close();
  });

  it("puts no code, key or recovery code in the audit trail or the logs", async () => {
    const email = await emailForRole("LOGISTICS");
    const account = await enableTwoStep(t, email);
    const right = codeAt(account.secret, FIXED_NOW);
    const wrong = wrongCodeAt(account.secret, FIXED_NOW);

    // Sign in with a wrong code, a right code, and a recovery code; fail twice more.
    const login = await passwordLogin(t, email);
    const token = challengeTokenOf(login) ?? "";
    await verifyWith(t, token, { code: wrong });
    await verifyWith(t, token, { recoveryCode: "ZZZZZ-ZZZZZ-ZZZZZ" });
    await verifyWith(t, token, { code: right });
    await verifyWith(t, await startChallenge(t, email), {
      recoveryCode: account.recoveryCodes[0],
    });

    const trail = JSON.stringify(await auditEvents(t));
    const logs = JSON.stringify(t.logLines());
    expect(trail.length).toBeGreaterThan(1000);
    expect(logs.length).toBeGreaterThan(1000);
    const long = [
      encodeBase32(account.secret),
      account.secret.toString("hex"),
      account.secret.toString("base64"),
      token,
      ...account.recoveryCodes,
      ...account.recoveryCodes.map((c) => normaliseRecoveryCode(c) ?? ""),
      "ZZZZZ-ZZZZZ-ZZZZZ",
    ];
    for (const text of [trail, logs]) {
      for (const secret of long) {
        expect(text, "a secret").not.toContain(secret);
      }
      // A six-digit code as a quoted value: a bare digit run also fits inside hashes.
      for (const code of [right, wrong]) {
        expect(text).not.toContain(`"${code}"`);
      }
    }
  });

  it("keeps the setup key, the recovery codes and the password out of the trail and the logs", async () => {
    const email = await emailForRole("WAREHOUSE");
    const browser = await passwordSignIn(t, email);
    const post = (path: string, body: object) =>
      call(t, browser, "post", `${API}/auth/two-step/${path}`, {
        csrf: true,
        body,
      });

    const setup = await post("setup", { password: TEST_DEMO_PASSWORD });
    const { setupKey } = twoStepSetupResponseSchema.parse(setup.body).data;
    const secret = decodeBase32(setupKey) ?? Buffer.alloc(0);
    const code = codeAt(secret, FIXED_NOW);
    const enable = await post("enable", { code });
    const { recoveryCodes } = recoveryCodesResponseSchema.parse(
      enable.body,
    ).data;
    await post("disable", {
      password: TEST_DEMO_PASSWORD,
      recoveryCode: recoveryCodes[0],
    });

    const trail = JSON.stringify(await auditEvents(t));
    const logs = JSON.stringify(t.logLines());
    for (const text of [trail, logs]) {
      for (const secretText of [
        setupKey,
        secret.toString("hex"),
        TEST_DEMO_PASSWORD,
        ...recoveryCodes,
        ...recoveryCodes.map((c) => normaliseRecoveryCode(c) ?? ""),
      ]) {
        expect(text).not.toContain(secretText);
      }
      expect(text).not.toContain(`"${code}"`);
    }
    // The three answers that carry a secret are marked not to be cached.
    expect(setup.headers["cache-control"]).toBe("no-store");
    expect(enable.headers["cache-control"]).toBe("no-store");
    expect(trail).toContain("auth.two-step.setup-started");
  });
});
