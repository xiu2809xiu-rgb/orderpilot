import { createHmac } from "node:crypto";
import {
  COOKIES,
  errorEnvelopeSchema,
  sessionResponseSchema,
} from "@orderpilot/shared";
import request from "supertest";
import { Clock } from "../../src/common/clock.js";
import { encodeBase32 } from "../../src/two-step/domain/base32.js";
import {
  formatRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "../../src/two-step/domain/recovery-codes.js";
import { SecretBox } from "../../src/two-step/domain/secret-box.js";
import { RecoveryCodeRepository } from "../../src/two-step/recovery-code.repository.js";
import { TwoStepRepository } from "../../src/two-step/two-step.repository.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  browserFrom,
  parseSetCookie,
  type Browser,
} from "./auth.js";
import type { TestApp } from "./test-app.js";

/** The one moment every two-step test starts from. */
export const FIXED_NOW = new Date("2026-11-24T10:00:00.000Z");

/** The RFC 6238 seed. Plainly made up, as the RFC says. */
export const RFC_SEED = Buffer.from("12345678901234567890");

/** Built, not written out, so no base32 literal sits in the source. */
export function rfcSeedBase32(): string {
  return encodeBase32(RFC_SEED);
}

/**
 * An independent HOTP of RFC 4226, so the tests never compute their expected
 * codes with the class under test.
 */
export function hotp(secret: Uint8Array, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac("sha1", secret).update(message).digest();
  const last = mac[19] ?? 0;
  const offset = last & 15;
  const binary =
    (((mac[offset] ?? 0) & 127) << 24) |
    ((mac[offset + 1] ?? 0) << 16) |
    ((mac[offset + 2] ?? 0) << 8) |
    (mac[offset + 3] ?? 0);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function stepOf(at: Date): number {
  return Math.floor(at.getTime() / 30_000);
}

/** The code an authenticator app would show at `at`, `offset` steps away. */
export function codeAt(secret: Uint8Array, at: Date, offset = 0): string {
  return hotp(secret, stepOf(at) + offset);
}

/** A code that is not the right one for any of the three accepted steps. */
export function wrongCodeAt(secret: Uint8Array, at: Date): string {
  const right = new Set([-1, 0, 1].map((o) => codeAt(secret, at, o)));
  for (let n = 0; n < 1_000_000; n += 1) {
    const candidate = String(n).padStart(6, "0");
    if (!right.has(candidate)) return candidate;
  }
  throw new Error("no wrong code found");
}

/** A clock a test moves by hand. */
export class TestClock extends Clock {
  constructor(private current: Date = FIXED_NOW) {
    super();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(at: Date): void {
    this.current = new Date(at);
  }
}

// ---- Helpers that drive the running app ------------------------------------

export const VERIFY_PATH = `${API}/auth/two-step/verify`;

export interface TwoStepAccount {
  readonly email: string;
  readonly userId: string;
  readonly secret: Buffer;
  /** The ten recovery codes as the person would see them: XXXXX-XXXXX-XXXXX. */
  readonly recoveryCodes: string[];
}

/**
 * Switches two-step on for a seeded account straight in the database, as the
 * settings routes would leave it: the secret sealed, ten recovery codes, no
 * counters. Any earlier row of that account is deleted first, so every test
 * starts clean. The last accepted step is set well in the past so a code of
 * the current time is fresh.
 */
export async function enableTwoStep(
  t: TestApp,
  email: string,
  options: { secret?: Buffer; at?: Date; box?: SecretBox } = {},
): Promise<TwoStepAccount> {
  const user = await t.app.get(UserRepository).findByEmail(email);
  if (!user) throw new Error(`no seeded account ${email}`);
  const secrets = t.app.get(TwoStepRepository);
  const secret = options.secret ?? RFC_SEED;
  const at = options.at ?? FIXED_NOW;
  await secrets.deleteForUser(user.id);
  const box: SecretBox = options.box ?? t.app.get(SecretBox);
  await secrets.startSetup(user.id, box.seal(secret, user.id), at);
  await secrets.activate(user.id, stepOf(at) - 5, at);
  const raw = generateRecoveryCodes(10);
  await t.app
    .get(RecoveryCodeRepository)
    .replaceAll(user.id, raw.map(hashRecoveryCode));
  return {
    email,
    userId: user.id,
    secret,
    recoveryCodes: raw.map(formatRecoveryCode),
  };
}

/** Takes two-step away from an account, as a turn-off or a reset would. */
export async function clearTwoStep(t: TestApp, email: string): Promise<void> {
  const user = await t.app.get(UserRepository).findByEmail(email);
  if (user) await t.app.get(TwoStepRepository).deleteForUser(user.id);
}

export function passwordLogin(
  t: TestApp,
  email: string,
  password: string = TEST_DEMO_PASSWORD,
): request.Test {
  return request(t.app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password });
}

/** The value of the challenge cookie a login answer set, or null. */
export function challengeTokenOf(res: request.Response): string | null {
  return parseSetCookie(res.headers["set-cookie"])[COOKIES.twoStep] ?? null;
}

/** A password sign-in that stops at the second step. Returns the cookie value. */
export async function startChallenge(
  t: TestApp,
  email: string,
): Promise<string> {
  const res = await passwordLogin(t, email);
  const token = challengeTokenOf(res);
  if (res.status !== 401 || token === null || token === "") {
    throw new Error(`no challenge: ${String(res.status)} ${res.text}`);
  }
  return token;
}

/** The verify call as the page makes it: JSON, with the challenge cookie when there is one. */
export function verifyWith(
  t: TestApp,
  token: string | null,
  body: object,
): request.Test {
  const req = request(t.app.getHttpServer()).post(VERIFY_PATH);
  if (token !== null) req.set("Cookie", `${COOKIES.twoStep}=${token}`);
  return req.send(body);
}

/** A whole sign-in with a right code from the app: challenge, then verify. */
export async function signInWithCode(
  t: TestApp,
  account: TwoStepAccount,
  at: Date,
): Promise<Browser> {
  const token = await startChallenge(t, account.email);
  const res = await verifyWith(t, token, {
    code: codeAt(account.secret, at),
  });
  if (res.status !== 200) {
    throw new Error(`verify failed: ${String(res.status)} ${res.text}`);
  }
  return browserFrom(
    sessionResponseSchema.parse(res.body).data,
    res.headers["set-cookie"],
  );
}

export function errorCodeOf(res: request.Response): string {
  return errorEnvelopeSchema.parse(res.body).error.code;
}

/** Wrong codes on one challenge, one request each; the answers in order. */
export async function wrongTries(
  t: TestApp,
  token: string,
  account: TwoStepAccount,
  at: Date,
  count: number,
): Promise<request.Response[]> {
  const answers: request.Response[] = [];
  for (let n = 0; n < count; n += 1) {
    answers.push(
      await verifyWith(t, token, { code: wrongCodeAt(account.secret, at) }),
    );
  }
  return answers;
}
