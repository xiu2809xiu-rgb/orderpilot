import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Clock } from "../../src/common/clock.js";
import { encodeBase32 } from "../../src/two-step/domain/base32.js";
import { normaliseRecoveryCode } from "../../src/two-step/domain/recovery-codes.js";
import { auditEvents, emailForRole } from "../support/auth.js";
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
});
