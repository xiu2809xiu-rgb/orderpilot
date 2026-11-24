import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { Clock } from "../../src/common/clock.js";
import { Database } from "../../src/database/database.js";
import { emailForRole } from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  FIXED_NOW,
  TestClock,
  codeAt,
  enableTwoStep,
  errorCodeOf,
  passwordLogin,
  startChallenge,
  verifyWith,
} from "../support/two-step.js";

/** A promise a test settles by hand. */
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return {
    promise,
    resolve: () => {
      resolve();
    },
  };
}

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

describe("two-step concurrency", () => {
  let t: TestApp;
  let email: string;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (b) =>
      b.overrideProvider(Clock).useValue(new TestClock()),
    );
    email = await emailForRole("APPROVER");
  });
  afterAll(async () => {
    await t.close();
  });

  it("lets only one of two simultaneous verifies with the same code through", async () => {
    const account = await enableTwoStep(t, email);
    const first = await startChallenge(t, email);
    const second = await startChallenge(t, email);
    const code = codeAt(account.secret, FIXED_NOW);

    const answers = await Promise.all([
      verifyWith(t, first, { code }),
      verifyWith(t, second, { code }),
    ]);

    expect(answers.map((r) => r.status).sort()).toEqual([200, 422]);
    const refused = answers.find((r) => r.status === 422);
    expect(refused ? errorCodeOf(refused) : "").toBe("TWO_STEP_CODE_INVALID");
  });

  it("finishes a login and a verify for one person at the same time", async () => {
    const account = await enableTwoStep(t, email);
    const database = t.app.get(Database);
    const chain = t.app.get(AuditEventRepository);
    const watcher = new pg.Client({
      connectionString: testConfig().database.url,
    });
    await watcher.connect();
    const waiting = async (): Promise<number> => {
      const { rows } = await watcher.query<{ n: string }>(
        "SELECT count(*) AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted",
      );
      return Number(rows[0]?.n ?? 0);
    };
    try {
      const token = await startChallenge(t, email);

      // Hold the audit chain, as a busy server would, so both requests stop at
      // their audit write and the order they arrive in decides the outcome.
      const gate = deferred();
      const holding = deferred();
      const holder = database.transaction(async () => {
        await chain.lockChain();
        holding.resolve();
        await gate.promise;
      });
      await holding.promise;

      // The login comes first, and waits at the chain. Then the verify arrives:
      // it takes the person's row and waits at the chain behind the login.
      const login = passwordLogin(t, email).then((res) => res);
      const deadline = Date.now() + 10_000;
      while ((await waiting()) < 1 && Date.now() < deadline) await sleep(25);
      expect(await waiting()).toBe(1);
      const verify = verifyWith(t, token, {
        code: codeAt(account.secret, FIXED_NOW),
      }).then((res) => res);
      await sleep(700);
      gate.resolve();
      await holder;

      const [loginRes, verifyRes] = await Promise.all([login, verify]);
      expect(loginRes.status).toBe(401);
      expect(errorCodeOf(loginRes)).toBe("TWO_STEP_REQUIRED");
      expect(verifyRes.status).toBe(200);
    } finally {
      await watcher.end();
    }
  }, 60_000);

  it("finishes pairs of a login and a verify started together", async () => {
    for (let pair = 0; pair < 8; pair += 1) {
      const account = await enableTwoStep(t, email);
      const token = await startChallenge(t, email);

      const [loginRes, verifyRes] = await Promise.all([
        passwordLogin(t, email),
        verifyWith(t, token, { code: codeAt(account.secret, FIXED_NOW) }),
      ]);

      expect(loginRes.status, `login of pair ${String(pair)}`).toBe(401);
      expect(verifyRes.status, `verify of pair ${String(pair)}`).toBe(200);
    }
  }, 120_000);
});
