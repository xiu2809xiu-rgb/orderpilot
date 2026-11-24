import { createHmac } from "node:crypto";
import { Clock } from "../../src/common/clock.js";
import { encodeBase32 } from "../../src/two-step/domain/base32.js";

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
