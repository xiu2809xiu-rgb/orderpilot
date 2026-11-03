import { describe, expect, it } from "vitest";
import {
  AuthorisationPolicy,
  type PolicyContext,
  type PolicyRule,
} from "./authorisation-policy.js";
import { policyActionOf } from "./policy-actions.js";
import { PermissionRule, SystemAdminRule } from "./policy-rules.js";

const ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  role: "APPROVER",
} as const;

const context = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  actor: ACTOR,
  permission: "approvals.decide",
  roleHoldsPermission: true,
  ...overrides,
});

/** A rule that records that it ran, and refuses when told to. */
function probe(name: string, ran: string[], refuse: boolean): PolicyRule {
  return {
    name,
    refusal: () => {
      ran.push(name);
      return refuse ? `${name} says no` : null;
    },
  };
}

describe("the authorisation policy", () => {
  it("runs the rules in order, and the first refusal wins with its rule and reason", () => {
    const ran: string[] = [];
    const policy = new AuthorisationPolicy([
      probe("first", ran, false),
      probe("second", ran, true),
      probe("third", ran, true),
    ]);
    expect(policy.decide(context())).toEqual({
      outcome: "refused",
      rule: "second",
      reason: "second says no",
    });
    expect(ran).toEqual(["first", "second"]);
  });

  it("allows when no rule objects", () => {
    const ran: string[] = [];
    const policy = new AuthorisationPolicy([
      probe("first", ran, false),
      probe("second", ran, false),
    ]);
    expect(policy.decide(context()).outcome).toBe("allowed");
    expect(ran).toEqual(["first", "second"]);
  });
});

describe("the system admin rule", () => {
  const rule = new SystemAdminRule();

  it("refuses the system admin the right to approve, post or pay", () => {
    for (const permission of [
      "approvals.decide",
      "payments.confirm",
      "payments.post",
    ] as const) {
      const admin = context({
        actor: { ...ACTOR, role: "SYSTEM_ADMIN" },
        permission,
      });
      expect(rule.refusal(admin), permission).not.toBeNull();
      expect(rule.refusal(context({ permission })), permission).toBeNull();
    }
  });

  it("has no objection to the system admin configuring the platform", () => {
    const admin = context({
      actor: { ...ACTOR, role: "SYSTEM_ADMIN" },
      permission: "roles.manage",
    });
    expect(rule.refusal(admin)).toBeNull();
  });
});

describe("the permission rule", () => {
  const rule = new PermissionRule();

  it("refuses a role that does not hold the permission", () => {
    expect(rule.refusal(context({ roleHoldsPermission: false }))).toBe(
      "the role does not hold the permission",
    );
    expect(rule.refusal(context({ roleHoldsPermission: true }))).toBeNull();
  });
});

describe("the actions the policy knows", () => {
  it("checks an SPR and a vendor PO against the purchase limit", () => {
    expect(policyActionOf("spr.approve")).toEqual({
      permission: "approvals.decide",
      limit: "purchase",
    });
    expect(policyActionOf("purchase-order.approve")).toEqual({
      permission: "approvals.decide",
      limit: "purchase",
    });
  });

  it("checks a sales order against the sales limit, as a placeholder (A-19)", () => {
    expect(policyActionOf("sales-order.approve")).toEqual({
      permission: "approvals.decide",
      limit: "sales",
    });
  });

  it("knows no other action, not even one named after an object's own keys", () => {
    expect(policyActionOf("order.delete")).toBeUndefined();
    expect(policyActionOf("toString")).toBeUndefined();
    expect(policyActionOf("__proto__")).toBeUndefined();
  });
});
