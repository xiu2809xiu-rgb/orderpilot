import { describe, expect, it } from "vitest";
import { FIXED_NOW } from "../../../test/support/two-step.js";
import { judgeChallenge } from "./challenge-judge.js";

describe("judgeChallenge", () => {
  it("says ok before the expiry and expired at it", () => {
    const at = (ms: number) => ({
      expiresAt: new Date(FIXED_NOW.getTime() + ms),
    });
    expect(judgeChallenge(at(1), FIXED_NOW)).toBe("ok");
    expect(judgeChallenge(at(0), FIXED_NOW)).toBe("expired");
    expect(judgeChallenge(at(-1), FIXED_NOW)).toBe("expired");
  });

  it("says unknown for no challenge", () => {
    expect(judgeChallenge(null, FIXED_NOW)).toBe("unknown");
  });
});
