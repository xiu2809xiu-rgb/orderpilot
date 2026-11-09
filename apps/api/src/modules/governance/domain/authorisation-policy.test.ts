import { describe, expect, it } from "vitest";
import {
  AuthorisationPolicy,
  type PolicyContext,
  type PolicyRule,
} from "./authorisation-policy.js";
import type { ApprovalSetup, Approver } from "./approval-setup.js";
import { ACTION_POLICY } from "./policies.js";
import { policyActionOf } from "./policy-actions.js";
import { PermissionRule, SystemAdminRule } from "./policy-rules.js";

const ACTOR = {
  userId: "00000000-0000-4000-8000-000000000001",
  role: "APPROVER",
} as const;

const context = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({
  actor: ACTOR,
  action: "spr.approve",
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

describe("the payment actions (F-4)", () => {
  it("keeps confirming a customer's payment apart from paying a vendor", () => {
    expect(policyActionOf("customer-payment.confirm")).toEqual({
      permission: "payments.confirm",
    });
    expect(policyActionOf("vendor-payment.approve")).toEqual({
      permission: "payments.post",
    });
    expect(policyActionOf("vendor-payment.release")).toEqual({
      permission: "payments.post",
    });
  });

  it("gives a hold's two steps to two different permissions (F-5)", () => {
    expect(policyActionOf("payment-hold.verify")).toEqual({
      permission: "payments.confirm",
    });
    expect(policyActionOf("payment-hold.clear")).toEqual({
      permission: "approvals.decide",
    });
  });

  it("puts changing an approval setup behind roles.manage", () => {
    expect(policyActionOf("approval-setup.change")).toEqual({
      permission: "roles.manage",
    });
  });
});

describe("the order of the rules (F-4)", () => {
  const ME = ACTOR.userId;
  const MANAGEMENT = "00000000-0000-4000-8000-000000000009";
  const row = (userId: string, overrides: Partial<ApprovalSetup> = {}) => ({
    setup: {
      userId,
      approverId: null,
      salesAmountApprovalLimit: "0.00",
      purchaseAmountApprovalLimit: "100.00",
      unlimitedSalesApproval: false,
      unlimitedPurchaseApproval: false,
      substituteUserId: null,
      awayFrom: null,
      awayUntil: null,
      ...overrides,
    },
    disabled: false,
  });
  // I raised the SPR, my requests go to Management, and it is over my limit.
  const approvers = new Map<string, Approver>([
    [ME, row(ME, { approverId: MANAGEMENT })],
    [MANAGEMENT, row(MANAGEMENT)],
  ]);
  const myOwnSpr: PolicyContext = {
    actor: ACTOR,
    action: "spr.approve",
    permission: "approvals.decide",
    roleHoldsPermission: true,
    requesterUserId: ME,
    approval: {
      limit: "purchase",
      amount: "999.00",
      approvers,
      now: new Date("2026-11-06T09:00:00.000Z"),
    },
  };

  it("tells the system admin first that they never approve", () => {
    expect(
      ACTION_POLICY.decide({
        ...myOwnSpr,
        actor: { ...ACTOR, role: "SYSTEM_ADMIN" },
      }).rule,
    ).toBe("system-admin");
  });

  it("tells a role without the right that before anything else", () => {
    expect(
      ACTION_POLICY.decide({ ...myOwnSpr, roleHoldsPermission: false }).rule,
    ).toBe("permission");
  });

  it("refuses a requester for raising it, before the route or the limit", () => {
    expect(ACTION_POLICY.decide(myOwnSpr)).toMatchObject({
      outcome: "refused",
      rule: "no-self-approval",
    });
  });

  it("refuses a change to one's own setup even with roles.manage", () => {
    expect(
      ACTION_POLICY.decide({
        actor: { userId: ME, role: "SYSTEM_ADMIN" },
        action: "approval-setup.change",
        permission: "roles.manage",
        roleHoldsPermission: true,
        resource: { type: "ApprovalUserSetup", id: ME },
      }).rule,
    ).toBe("own-setup");
  });

  it("refuses an earlier duty's person before looking at any limit", () => {
    expect(
      ACTION_POLICY.decide({
        actor: { userId: ME, role: "FINANCE" },
        action: "vendor-payment.release",
        permission: "payments.post",
        roleHoldsPermission: true,
        vendorHold: { vendorNo: "V-0007", openHoldIds: [] },
        earlierDuties: { "vendor-bank.change": ME },
      }).rule,
    ).toBe("segregation-of-duties");
  });
});

describe("where the bank-detail hold's rules sit (F-5)", () => {
  const ME = ACTOR.userId;
  const HOLD = "00000000-0000-7000-8000-00000000aaaa";
  const heldRelease: PolicyContext = {
    actor: { userId: ME, role: "FINANCE" },
    action: "vendor-payment.release",
    permission: "payments.post",
    roleHoldsPermission: true,
    vendorHold: { vendorNo: "V-0007", openHoldIds: [HOLD] },
    requesterUserId: ME,
    earlierDuties: { "vendor-bank.change": ME },
  };

  it("tells the system admin first that they never pay", () => {
    expect(
      ACTION_POLICY.decide({
        ...heldRelease,
        actor: { userId: ME, role: "SYSTEM_ADMIN" },
      }).rule,
    ).toBe("system-admin");
  });

  it("tells a role without the right only that, and never about the hold", () => {
    const decision = ACTION_POLICY.decide({
      ...heldRelease,
      roleHoldsPermission: false,
    });
    expect(decision.rule).toBe("permission");
    expect(decision.reason).not.toContain(HOLD);
  });

  it("names the hold before any rule about one person, since it binds them all", () => {
    const decision = ACTION_POLICY.decide(heldRelease);
    expect(decision).toMatchObject({
      outcome: "refused",
      rule: "bank-detail-hold",
    });
    expect(decision.reason).toContain(HOLD);
  });

  const clearing = (earlierDuties: PolicyContext["earlierDuties"]) =>
    ACTION_POLICY.decide({
      actor: { userId: ME, role: "APPROVER" },
      action: "payment-hold.clear",
      permission: "approvals.decide",
      roleHoldsPermission: true,
      earlierDuties,
      holdClearance: {
        hold: {
          status: "open",
          openedAt: new Date("2026-11-09T09:00:00.000Z"),
          latestOutcome: null,
        },
        resolution: "accept-new-details",
        now: new Date("2026-11-10T09:00:00.000Z"),
      },
    });

  it("refuses the person before looking at the state of the hold", () => {
    expect(clearing({ "payment-hold.verify": ME }).rule).toBe(
      "segregation-of-duties",
    );
  });

  it("then looks at the state of the hold", () => {
    expect(clearing({}).rule).toBe("hold-verification");
  });
});
