import { describe, expect, it } from "vitest";
import {
  FIXED_NOW,
  RFC_SEED,
  codeAt,
  wrongCodeAt,
} from "../../../test/support/two-step.js";
import { Totp } from "./totp.js";

const totp = new Totp();
const current = totp.stepAt(FIXED_NOW);

describe("Totp", () => {
  it("gives the RFC 6238 SHA-1 codes for the six test times", () => {
    // The RFC lists eight digits; the six-digit code is their last six.
    const cases: [number, string][] = [
      [59, "287082"],
      [1_111_111_109, "081804"],
      [1_111_111_111, "050471"],
      [1_234_567_890, "005924"],
      [2_000_000_000, "279037"],
      [20_000_000_000, "353130"],
    ];
    for (const [seconds, code] of cases) {
      const step = totp.stepAt(new Date(seconds * 1000));
      expect(totp.codeFor(RFC_SEED, step)).toBe(code);
    }
  });

  it("agrees with an independent HOTP for the current step", () => {
    expect(totp.codeFor(RFC_SEED, current)).toBe(codeAt(RFC_SEED, FIXED_NOW));
  });

  it("accepts the step before, the current step and the step after", () => {
    for (const offset of [-1, 0, 1]) {
      expect(
        totp.judge(
          RFC_SEED,
          codeAt(RFC_SEED, FIXED_NOW, offset),
          FIXED_NOW,
          null,
        ),
      ).toEqual({ kind: "accepted", step: current + offset });
    }
  });

  it("refuses a code two steps away on either side", () => {
    const near = [-1, 0, 1].map((o) => codeAt(RFC_SEED, FIXED_NOW, o));
    for (const offset of [-2, 2]) {
      const code = codeAt(RFC_SEED, FIXED_NOW, offset);
      // Six digits can repeat: a far step that equals a near one is no test.
      expect(near).not.toContain(code);
      expect(totp.judge(RFC_SEED, code, FIXED_NOW, null)).toEqual({
        kind: "wrong",
      });
    }
  });

  it("refuses a wrong code", () => {
    expect(
      totp.judge(RFC_SEED, wrongCodeAt(RFC_SEED, FIXED_NOW), FIXED_NOW, null),
    ).toEqual({ kind: "wrong" });
  });

  it("refuses a step at or below the last accepted one as replayed", () => {
    const code = codeAt(RFC_SEED, FIXED_NOW, 0);
    expect(totp.judge(RFC_SEED, code, FIXED_NOW, current)).toEqual({
      kind: "replayed",
    });
    expect(totp.judge(RFC_SEED, code, FIXED_NOW, current + 1)).toEqual({
      kind: "replayed",
    });
    expect(totp.judge(RFC_SEED, code, FIXED_NOW, current - 1)).toEqual({
      kind: "accepted",
      step: current,
    });
  });

  it("takes the highest matching step when two steps give the same code", () => {
    // Found by a search outside the test: for this secret the steps before and
    // at FIXED_NOW give one code (a one in a million chance for any secret).
    const secret = Buffer.from("unit-seed-572229");
    const code = totp.codeFor(secret, current);
    expect(totp.codeFor(secret, current - 1)).toBe(code);
    expect(totp.judge(secret, code, FIXED_NOW, null)).toEqual({
      kind: "accepted",
      step: current,
    });
    // With the later step used already, the earlier one is too old as well.
    expect(totp.judge(secret, code, FIXED_NOW, current)).toEqual({
      kind: "replayed",
    });
  });

  it("checks all three candidates before it answers", () => {
    // A code of the last candidate (step + 1) is found although the first two
    // did not match: nothing stops at the first miss.
    const code = codeAt(RFC_SEED, FIXED_NOW, 1);
    expect(totp.judge(RFC_SEED, code, FIXED_NOW, null)).toEqual({
      kind: "accepted",
      step: current + 1,
    });
  });
});
