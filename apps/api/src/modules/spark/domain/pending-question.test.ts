import { describe, expect, it } from "vitest";
import { isAbandoned, pendingLimitMs } from "./pending-question.js";

const limits = { timeoutMs: 60_000, maxAttempts: 3, maxToolSteps: 5 };

describe("how long a question may wait for its answer", () => {
  it("is every tool step and the final text, each tried up to the attempt cap within the timeout", () => {
    expect(pendingLimitMs(limits)).toBe(60_000 * 3 * 6);
  });

  it("does not call a question abandoned at the limit, and does a millisecond after", () => {
    const askedAt = new Date("2026-11-22T09:00:00.000Z");
    const at = (ms: number) => new Date(askedAt.getTime() + ms);
    expect(isAbandoned(askedAt, at(pendingLimitMs(limits)), limits)).toBe(
      false,
    );
    expect(isAbandoned(askedAt, at(pendingLimitMs(limits) + 1), limits)).toBe(
      true,
    );
  });

  it("is shorter when the gateway is told to wait less", () => {
    const tight = { timeoutMs: 1000, maxAttempts: 1, maxToolSteps: 1 };
    expect(pendingLimitMs(tight)).toBe(2000);
  });
});
