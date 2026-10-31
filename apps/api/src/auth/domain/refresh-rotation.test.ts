import { describe, expect, it } from "vitest";
import { judgeRefreshToken } from "./refresh-rotation.js";

const now = new Date("2026-11-02T10:00:00.000Z");
const later = new Date("2026-11-09T10:00:00.000Z");
const earlier = new Date("2026-11-01T10:00:00.000Z");
const live = { usedAt: null, revokedAt: null, expiresAt: later };

describe("judgeRefreshToken", () => {
  it("accepts a live token", () => {
    expect(judgeRefreshToken(live, now)).toBe("ok");
  });

  it("says unknown for no token", () => {
    expect(judgeRefreshToken(null, now)).toBe("unknown");
  });

  it("calls a token that was used already a reuse, even after it expired", () => {
    expect(judgeRefreshToken({ ...live, usedAt: earlier }, now)).toBe("reused");
    expect(
      judgeRefreshToken({ ...live, usedAt: earlier, expiresAt: earlier }, now),
    ).toBe("reused");
  });

  it("does not report a second reuse once the family is revoked", () => {
    expect(
      judgeRefreshToken({ ...live, usedAt: earlier, revokedAt: earlier }, now),
    ).toBe("revoked");
  });

  it("refuses a revoked token", () => {
    expect(judgeRefreshToken({ ...live, revokedAt: earlier }, now)).toBe(
      "revoked",
    );
  });

  it("refuses an expired token", () => {
    expect(judgeRefreshToken({ ...live, expiresAt: earlier }, now)).toBe(
      "expired",
    );
    expect(judgeRefreshToken({ ...live, expiresAt: now }, now)).toBe("expired");
  });
});
