import { ROLES, type MaskingRule, type Role } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { AUDIT_MASKING_RULES, maskChanges } from "./audit-masking.js";

const exact: MaskingRule = {
  field: "Thing.price",
  label: "Price",
  classification: "confidential",
  reason: "price",
  visibleTo: ["FINANCE"],
  sample: false,
};

describe("maskChanges", () => {
  it("returns nothing for an event with no changes", () => {
    expect(maskChanges(AUDIT_MASKING_RULES, "AUDITOR", "User", null)).toEqual(
      [],
    );
  });

  it("shows a field that has no rule, as internal", () => {
    const [entry] = maskChanges(AUDIT_MASKING_RULES, "FINANCE", "User", {
      sessionsRevoked: 2,
    });
    expect(entry).toEqual({
      field: "sessionsRevoked",
      classification: "internal",
      masked: false,
      reason: null,
      change: false,
      before: null,
      after: "2",
    });
  });

  it("reads a { from, to } entry as a before and after pair", () => {
    const [entry] = maskChanges(AUDIT_MASKING_RULES, "FINANCE", "User", {
      disabled: { from: false, to: true },
    });
    expect(entry).toMatchObject({
      change: true,
      before: "false",
      after: "true",
    });
  });

  it("does not read a two-key object with other keys as a pair", () => {
    const [entry] = maskChanges([], "FINANCE", "Thing", {
      box: { from: 1, other: 2 },
    });
    expect(entry).toMatchObject({
      change: false,
      after: '{"from":1,"other":2}',
    });
  });

  it("hides a value from a role the rule does not list, keeping the reason and no value", () => {
    const [entry] = maskChanges([exact], "SUPPORT", "Thing", {
      price: { from: "4.20", to: "4.35" },
    });
    expect(entry).toEqual({
      field: "price",
      classification: "confidential",
      masked: true,
      reason: "price",
      change: true,
      before: null,
      after: null,
    });
    expect(JSON.stringify(entry)).not.toContain("4.20");
  });

  it("shows it to a role the rule lists", () => {
    const [entry] = maskChanges([exact], "FINANCE", "Thing", { price: "4.35" });
    expect(entry).toMatchObject({ masked: false, after: "4.35" });
  });

  it("applies a wildcard rule to every entity type, and an exact rule only to its own", () => {
    const rules = [...AUDIT_MASKING_RULES, exact];
    const reason = (entityType: string) =>
      maskChanges(rules, "WAREHOUSE", entityType, {
        reason: "wrong-password",
      })[0];
    expect(reason("User")?.masked).toBe(true);
    expect(reason("ApiRoute")?.masked).toBe(true);
    expect(
      maskChanges(rules, "SUPPORT", "Other", { price: "1" })[0]?.masked,
    ).toBe(false);
  });

  it("shows the sample rule to the auditor and the administrator, and to no one else", () => {
    const seen = (role: Role) =>
      maskChanges(AUDIT_MASKING_RULES, role, "User", { reason: "x" })[0]
        ?.masked;
    expect(seen("AUDITOR")).toBe(false);
    expect(seen("SYSTEM_ADMIN")).toBe(false);
    for (const role of ROLES.filter(
      (r) => r !== "AUDITOR" && r !== "SYSTEM_ADMIN",
    )) {
      expect(seen(role), role).toBe(true);
    }
  });

  it("shows the last four of a bank detail to the auditor and the administrator only", () => {
    const seen = (role: Role) =>
      maskChanges(AUDIT_MASKING_RULES, role, "VendorBankHold", {
        bankAccountNo: { from: "****9901", to: "****7702" },
      })[0];
    for (const role of ["AUDITOR", "SYSTEM_ADMIN"] as const) {
      expect(seen(role), role).toMatchObject({
        masked: false,
        before: "****9901",
        after: "****7702",
      });
    }
    expect(seen("FINANCE")).toMatchObject({
      masked: true,
      reason: "bankDetails",
      before: null,
      after: null,
    });
  });
});
