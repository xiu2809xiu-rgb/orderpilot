import { describe, expect, it } from "vitest";
import type { PolicyContext } from "./authorisation-policy.js";
import { NoSelfApprovalRule } from "./no-self-approval-rule.js";

const ME = "00000000-0000-4000-8000-000000000001";
const SOMEONE_ELSE = "00000000-0000-4000-8000-000000000002";

const context = (requesterUserId: string | undefined): PolicyContext => ({
  actor: { userId: ME, role: "APPROVER" },
  action: "spr.approve",
  permission: "approvals.decide",
  roleHoldsPermission: true,
  requesterUserId,
});

describe("the no-self-approval rule", () => {
  const rule = new NoSelfApprovalRule();

  it("refuses whoever raised the request, whatever their role", () => {
    expect(rule.refusal(context(ME))).toBe(
      "whoever raised a request never decides it",
    );
    for (const role of ["APPROVER", "MANAGEMENT", "FINANCE"] as const) {
      expect(
        rule.refusal({ ...context(ME), actor: { userId: ME, role } }),
        role,
      ).not.toBeNull();
    }
  });

  it("has no objection to someone else, or to a request with no requester", () => {
    expect(rule.refusal(context(SOMEONE_ELSE))).toBeNull();
    expect(rule.refusal(context(undefined))).toBeNull();
  });
});
