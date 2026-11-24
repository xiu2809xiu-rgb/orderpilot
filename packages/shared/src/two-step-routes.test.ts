import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  TWO_STEP_COOKIE_PATH,
  TWO_STEP_VERIFY_PATH,
  apiPath,
  twoStepDisableRequestSchema,
  twoStepCodeSchema,
  twoStepRoutes,
  twoStepVerifyRequestSchema,
} from "./index.js";

const NEW_CODES = [
  "TWO_STEP_REQUIRED",
  "TWO_STEP_CHALLENGE_ENDED",
  "TWO_STEP_CODE_INVALID",
  "TWO_STEP_LOCKED",
  "TWO_STEP_SETUP_ENDED",
  "PASSWORD_INCORRECT",
] as const;

describe("two-step contract", () => {
  it("accepts six digits and refuses five or seven", () => {
    expect(twoStepCodeSchema.safeParse("012345").success).toBe(true);
    expect(twoStepCodeSchema.safeParse("12345").success).toBe(false);
    expect(twoStepCodeSchema.safeParse("1234567").success).toBe(false);
    expect(twoStepCodeSchema.safeParse("12345a").success).toBe(false);
    expect(twoStepCodeSchema.safeParse("123 456").success).toBe(false);
  });

  it("accepts exactly one of code and recovery code", () => {
    const recovery = "ABCDE-FGHJK-LMNPQ";
    expect(
      twoStepVerifyRequestSchema.safeParse({ code: "123456" }).success,
    ).toBe(true);
    expect(
      twoStepVerifyRequestSchema.safeParse({ recoveryCode: recovery }).success,
    ).toBe(true);
    expect(twoStepVerifyRequestSchema.safeParse({}).success).toBe(false);
    expect(
      twoStepVerifyRequestSchema.safeParse({
        code: "123456",
        recoveryCode: recovery,
      }).success,
    ).toBe(false);
    expect(
      twoStepDisableRequestSchema.safeParse({
        password: "x",
        code: "123456",
        recoveryCode: recovery,
      }).success,
    ).toBe(false);
    expect(
      twoStepDisableRequestSchema.safeParse({ recoveryCode: recovery }).success,
    ).toBe(true);
  });

  it("gives every new error code a status of 400 or more, appended after the old ones", () => {
    for (const code of NEW_CODES) {
      expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    }
    expect(ERROR_HTTP_STATUS.TWO_STEP_REQUIRED).toBe(401);
    expect(ERROR_HTTP_STATUS.TWO_STEP_CODE_INVALID).toBe(422);
    expect(ERROR_HTTP_STATUS.TWO_STEP_LOCKED).toBe(429);
    // The web derives its status-to-code fallback from the order: the first
    // code declared for a status wins, so a new 401 must come after UNAUTHENTICATED.
    expect(ERROR_CODES.indexOf("TWO_STEP_REQUIRED")).toBeGreaterThan(
      ERROR_CODES.indexOf("UNAUTHENTICATED"),
    );
  });

  it("keeps the challenge cookie on the verify path only", () => {
    expect(twoStepRoutes.verify.path).toBe(TWO_STEP_VERIFY_PATH);
    expect(TWO_STEP_COOKIE_PATH).toBe(apiPath(TWO_STEP_VERIFY_PATH));
  });
});
