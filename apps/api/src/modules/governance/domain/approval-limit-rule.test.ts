import { describe, expect, it } from "vitest";
import { ApprovalLimitRule, SUBSTITUTE_LIMITS } from "./approval-limit-rule.js";
import type { ApprovalSetup, Approver } from "./approval-setup.js";
import type { ApprovalFacts, PolicyContext } from "./authorisation-policy.js";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const REQUESTER = id(1);
const APPROVER = id(2);
const SUBSTITUTE = id(3);
const MANAGEMENT = id(4);

const NOW = new Date("2026-11-03T09:00:00.000Z");
const HOUR = 3_600_000;
const at = (offsetHours: number) =>
  new Date(NOW.getTime() + offsetHours * HOUR);

function setup(
  userId: string,
  overrides: Partial<ApprovalSetup> = {},
): ApprovalSetup {
  return {
    userId,
    approverId: null,
    salesAmountApprovalLimit: "0.00",
    purchaseAmountApprovalLimit: "0.00",
    unlimitedSalesApproval: false,
    unlimitedPurchaseApproval: false,
    substituteUserId: null,
    awayFrom: null,
    awayUntil: null,
    ...overrides,
  };
}

/**
 * The sample chain: the requester's approver has limits and a substitute, and
 * escalates to Management, who is unlimited.
 */
function chain(
  changes: {
    approver?: Partial<ApprovalSetup>;
    substitute?: Partial<ApprovalSetup>;
    management?: Partial<ApprovalSetup>;
    disabled?: readonly string[];
    missing?: readonly string[];
  } = {},
): ReadonlyMap<string, Approver> {
  const rows = [
    setup(REQUESTER, { approverId: APPROVER }),
    setup(APPROVER, {
      approverId: MANAGEMENT,
      substituteUserId: SUBSTITUTE,
      salesAmountApprovalLimit: "20000.00",
      purchaseAmountApprovalLimit: "5000.00",
      ...changes.approver,
    }),
    setup(SUBSTITUTE, {
      approverId: MANAGEMENT,
      salesAmountApprovalLimit: "3000.00",
      purchaseAmountApprovalLimit: "3000.00",
      ...changes.substitute,
    }),
    setup(MANAGEMENT, {
      unlimitedSalesApproval: true,
      unlimitedPurchaseApproval: true,
      ...changes.management,
    }),
  ];
  return new Map(
    rows
      .filter((row) => !changes.missing?.includes(row.userId))
      .map((row) => [
        row.userId,
        {
          setup: row,
          disabled: changes.disabled?.includes(row.userId) ?? false,
        },
      ]),
  );
}

const away = { awayFrom: at(-1), awayUntil: at(1) };

/** An action that needs no approval, such as reading. */
const plain = (actorUserId: string): PolicyContext => ({
  actor: { userId: actorUserId, role: "APPROVER" },
  action: "spr.approve",
  permission: "approvals.decide",
  roleHoldsPermission: true,
});

function context(
  actorUserId: string,
  overrides: Partial<ApprovalFacts> & {
    readonly requesterUserId?: string | undefined;
  } = {},
): PolicyContext {
  // An explicit `requesterUserId: undefined` must survive, so no default parameter.
  const { requesterUserId, ...approval } = {
    requesterUserId: REQUESTER,
    ...overrides,
  };
  return {
    actor: { userId: actorUserId, role: "APPROVER" },
    action: "spr.approve",
    permission: "approvals.decide",
    roleHoldsPermission: true,
    requesterUserId,
    approval: {
      limit: "purchase",
      amount: "100.00",
      approvers: chain(),
      now: NOW,
      group: { approvers: [], reason: null },
      groupDecides: false,
      limitsOn: true,
      ...approval,
    },
  };
}

describe("the approval limit rule", () => {
  const rule = new ApprovalLimitRule();

  it("has no objection to an action that needs no approval", () => {
    expect(rule.refusal(plain(APPROVER))).toBeNull();
  });

  it("has no objection while limits are switched off, whatever the amount (#252)", () => {
    for (const amount of ["5000.01", "999999999.99"]) {
      expect(
        rule.refusal(context(APPROVER, { amount, limitsOn: false })),
        amount,
      ).toBeNull();
    }
    expect(
      rule.refusal(
        context("00000000-0000-4000-8000-000000000999", { limitsOn: false }),
      ),
    ).toBeNull();
  });

  it("allows an amount under the limit and exactly at it", () => {
    for (const amount of ["0.00", "4999.99", "5000", "5000.00", "5000.0000"]) {
      expect(rule.refusal(context(APPROVER, { amount })), amount).toBeNull();
    }
  });

  it("refuses an amount over the limit by a cent, or by less", () => {
    for (const amount of ["5000.01", "5000.0001"]) {
      expect(rule.refusal(context(APPROVER, { amount })), amount).toContain(
        "purchase approval limit",
      );
    }
  });

  it("lets a limit of zero approve nothing above zero", () => {
    const approvers = chain({
      approver: { purchaseAmountApprovalLimit: "0.00" },
    });
    expect(
      rule.refusal(context(APPROVER, { approvers, amount: "0.00" })),
    ).toBeNull();
    expect(
      rule.refusal(context(APPROVER, { approvers, amount: "0.01" })),
    ).not.toBeNull();
  });

  it("lets the unlimited flag approve any amount of its own kind only", () => {
    const approvers = chain({ approver: { unlimitedPurchaseApproval: true } });
    const huge = "999999999999999.99";
    expect(
      rule.refusal(context(APPROVER, { approvers, amount: huge })),
    ).toBeNull();
    expect(
      rule.refusal(
        context(APPROVER, { approvers, amount: huge, limit: "sales" }),
      ),
    ).not.toBeNull();
  });

  it("keeps the sales and purchase limits apart", () => {
    const amount = "10000.00";
    expect(
      rule.refusal(context(APPROVER, { amount, limit: "sales" })),
    ).toBeNull();
    expect(
      rule.refusal(context(APPROVER, { amount, limit: "purchase" })),
    ).toContain("purchase approval limit");
    const unlimitedSales = chain({
      approver: { unlimitedSalesApproval: true },
    });
    expect(
      rule.refusal(context(APPROVER, { amount, approvers: unlimitedSales })),
    ).not.toBeNull();
  });

  it("refuses an approval with no amount, or with an amount below zero", () => {
    expect(
      rule.refusal(context(APPROVER, { amount: undefined })),
    ).not.toBeNull();
    expect(rule.refusal(context(APPROVER, { amount: "-0.01" }))).not.toBeNull();
  });

  it("refuses an actor with no approval setup", () => {
    const approvers = chain({ missing: [APPROVER] });
    expect(rule.refusal(context(APPROVER, { approvers }))).not.toBeNull();
  });

  describe("for a substitute", () => {
    const approvers = chain({ approver: away });

    it("uses the substitute's own limit today", () => {
      expect(SUBSTITUTE_LIMITS).toBe("own");
      expect(
        rule.refusal(context(SUBSTITUTE, { approvers, amount: "3000.00" })),
      ).toBeNull();
      // The approver's limit (5000.00) would cover it; the substitute's does not.
      expect(
        rule.refusal(context(SUBSTITUTE, { approvers, amount: "3000.01" })),
      ).not.toBeNull();
    });

    it("uses the absent approver's limit when the setting is flipped", () => {
      const flipped = new ApprovalLimitRule("approver");
      expect(
        flipped.refusal(context(SUBSTITUTE, { approvers, amount: "5000.00" })),
      ).toBeNull();
      expect(
        flipped.refusal(context(SUBSTITUTE, { approvers, amount: "5000.01" })),
      ).not.toBeNull();
    });

    it("uses the substitute's own limit when they act outside the absence", () => {
      const flipped = new ApprovalLimitRule("approver");
      expect(
        flipped.refusal(context(SUBSTITUTE, { amount: "3000.01" })),
      ).not.toBeNull();
    });
  });
});
