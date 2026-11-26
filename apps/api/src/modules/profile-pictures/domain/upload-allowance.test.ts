import { describe, expect, it } from "vitest";
import { UploadAllowance } from "./upload-allowance.js";

// One fixed moment, passed in.
const NOW = new Date("2026-11-24T12:00:00.000Z");
const allowance = new UploadAllowance();

describe("UploadAllowance", () => {
  it("allows the 10th picture in 24 hours and refuses the 11th", () => {
    // Nine are stored: the tenth is allowed. Ten are stored: the eleventh is not.
    expect(allowance.judge(9, 10)).toEqual({ ok: true });
    expect(allowance.judge(10, 10)).toEqual({
      ok: false,
      code: "upload_limit",
    });
    expect(allowance.judge(11, 10)).toEqual({
      ok: false,
      code: "upload_limit",
    });
    expect(allowance.judge(0, 10)).toEqual({ ok: true });
  });

  it("looks back exactly 24 hours from now", () => {
    expect(allowance.windowStart(NOW).toISOString()).toBe(
      "2026-11-23T12:00:00.000Z",
    );
  });

  it("does not move the moment it was given", () => {
    allowance.windowStart(NOW);
    expect(NOW.toISOString()).toBe("2026-11-24T12:00:00.000Z");
  });
});
