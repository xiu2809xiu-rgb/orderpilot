import { createHmac } from "node:crypto";

// A six-digit code as an authenticator app makes it (RFC 6238, HMAC-SHA1, 30
// second steps), computed here from the setup key the page shows. Written out
// again on purpose, with `node:crypto` only: a test that used the API's own
// class would agree with it even when both were wrong.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

/** The bytes of a base32 key, with or without spaces and padding. */
export function decodeBase32(key: string): Buffer {
  const symbols = key.replace(/[\s=-]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const symbol of symbols) {
    const index = ALPHABET.indexOf(symbol);
    if (index < 0)
      throw new Error("The setup key holds a character it should not.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** The 30 second step a moment falls in. */
export function stepOf(at: Date): number {
  return Math.floor(at.getTime() / 1000 / STEP_SECONDS);
}

/** The six digits for one step. */
export function codeAt(key: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  // RFC 6238 and every authenticator app require HMAC-SHA1 here.
  const digest = createHmac("sha1", decodeBase32(key)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * The step to use next: the smallest one above the last the server accepted
 * that is never behind the clock. The server takes the current step and one
 * either side, each only once, so this needs no sleeping: the second code of a
 * flow is simply the step after the first. A third code would fall outside the
 * window if no time had passed, so a flow uses at most two (ADR 0067).
 */
export function nextStep(last: number | null, now: Date): number {
  const current = stepOf(now);
  return last === null ? current : Math.max(last + 1, current);
}
