import { createHmac, timingSafeEqual } from "node:crypto";
import { TWO_STEP_RULES } from "./two-step-rules.js";

export type TotpVerdict =
  | { readonly kind: "accepted"; readonly step: number }
  /** A right code, but for a step already used (or an earlier one). */
  | { readonly kind: "replayed" }
  | { readonly kind: "wrong" };

const MODULUS = 10 ** TWO_STEP_RULES.digits;

/**
 * RFC 6238 time-based codes: 30 second steps, six digits, one step either side
 * of now. Pure: time is an argument. The caller stores the last accepted step
 * and passes it back, which is what makes a code work once.
 */
export class Totp {
  stepAt(now: Date): number {
    return Math.floor(now.getTime() / 1000 / TWO_STEP_RULES.stepSeconds);
  }

  /** The six digits for one step: RFC 4226 over the step as the counter. */
  codeFor(secret: Uint8Array, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    // RFC 6238 and every authenticator app require HMAC-SHA1 here. The code is
    // short-lived and rate-limited, and SHA-1's weakness is collisions.
    const mac = createHmac("sha1", secret).update(counter).digest();
    const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
    const binary =
      (((mac[offset] ?? 0) & 0x7f) << 24) |
      ((mac[offset + 1] ?? 0) << 16) |
      ((mac[offset + 2] ?? 0) << 8) |
      (mac[offset + 3] ?? 0);
    return String(binary % MODULUS).padStart(TWO_STEP_RULES.digits, "0");
  }

  /**
   * All three candidates are compared before anything is answered, so the time
   * taken does not say which step matched. When two steps give the same code
   * the highest one above `lastStep` is taken, so it is the one remembered.
   */
  judge(
    secret: Uint8Array,
    code: string,
    now: Date,
    lastStep: number | null,
  ): TotpVerdict {
    const presented = Buffer.from(code);
    const current = this.stepAt(now);
    const { windowSteps } = TWO_STEP_RULES;
    let best: number | null = null;
    let matchedUsed = false;
    for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
      const step = current + offset;
      const expected = Buffer.from(this.codeFor(secret, step));
      const same =
        expected.length === presented.length &&
        timingSafeEqual(expected, presented);
      if (!same) continue;
      if (lastStep !== null && step <= lastStep) matchedUsed = true;
      else if (best === null || step > best) best = step;
    }
    if (best !== null) return { kind: "accepted", step: best };
    return matchedUsed ? { kind: "replayed" } : { kind: "wrong" };
  }
}
