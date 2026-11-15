import { describe, expect, it } from "vitest";
import { baseEnv } from "../../../test/support/base-env.js";
import { AppConfig } from "../../config/app-config.js";

// The approver group's limits are switchable, with none set, until Spectra
// confirms them (ADR 0049, ADR 0054): off unless someone turns them on.
describe("APPROVAL_LIMITS", () => {
  it("is off when it is not set", () => {
    expect(AppConfig.fromEnv(baseEnv()).governance.approvalLimits).toBe(false);
  });

  it("is on only when it says on", () => {
    expect(
      AppConfig.fromEnv(baseEnv({ APPROVAL_LIMITS: "on" })).governance
        .approvalLimits,
    ).toBe(true);
    expect(
      AppConfig.fromEnv(baseEnv({ APPROVAL_LIMITS: "off" })).governance
        .approvalLimits,
    ).toBe(false);
  });

  it("refuses any other value, so a typo cannot switch limits on or off by surprise", () => {
    for (const value of ["yes", "true", "ON", ""]) {
      expect(
        () => AppConfig.fromEnv(baseEnv({ APPROVAL_LIMITS: value })),
        value,
      ).toThrow();
    }
  });
});

// Temporary (ADR 0054): off keeps the old chain until area 2 moves (#251).
describe("APPROVER_GROUP", () => {
  it("is off when it is not set, so main behaves as before #252", () => {
    expect(AppConfig.fromEnv(baseEnv()).governance.approverGroup).toBe(false);
  });

  it("is on only when it says on, and refuses any other value", () => {
    expect(
      AppConfig.fromEnv(baseEnv({ APPROVER_GROUP: "on" })).governance
        .approverGroup,
    ).toBe(true);
    for (const value of ["yes", "true", "ON", ""]) {
      expect(
        () => AppConfig.fromEnv(baseEnv({ APPROVER_GROUP: value })),
        value,
      ).toThrow();
    }
  });
});
