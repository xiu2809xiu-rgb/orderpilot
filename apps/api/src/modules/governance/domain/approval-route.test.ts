import { describe, expect, it } from "vitest";
import { ApprovalRouteRule, deciderFor } from "./approval-route.js";
import type { ApprovalSetup, Approver } from "./approval-setup.js";
import type { ApprovalFacts, PolicyContext } from "./authorisation-policy.js";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const REQUESTER = id(1);
const APPROVER = id(2);
const SUBSTITUTE = id(3);
const MANAGEMENT = id(4);
const STRANGER = id(5);

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
      ...approval,
    },
  };
}

describe("who may decide a request", () => {
  it("is the requester's approver while they are present", () => {
    expect(deciderFor(REQUESTER, chain(), NOW)).toEqual({
      kind: "approver",
      userId: APPROVER,
    });
  });

  it("counts the approver away from awayFrom, and back at awayUntil", () => {
    const window = { awayFrom: NOW, awayUntil: at(2) };
    expect(deciderFor(REQUESTER, chain({ approver: window }), NOW).kind).toBe(
      "substitute",
    );
    expect(
      deciderFor(REQUESTER, chain({ approver: window }), at(-0.001)).kind,
    ).toBe("approver");
    expect(deciderFor(REQUESTER, chain({ approver: window }), at(2)).kind).toBe(
      "approver",
    );
  });

  it("treats an absence with no end as lasting until it is cleared", () => {
    const open = { awayFrom: at(-1), awayUntil: null };
    expect(
      deciderFor(REQUESTER, chain({ approver: open }), at(10_000)).kind,
    ).toBe("substitute");
  });

  it("is the substitute while the approver is away", () => {
    expect(deciderFor(REQUESTER, chain({ approver: away }), NOW)).toEqual({
      kind: "substitute",
      userId: SUBSTITUTE,
      standsInFor: APPROVER,
    });
  });

  it("is the substitute while the approver is disabled", () => {
    expect(
      deciderFor(REQUESTER, chain({ disabled: [APPROVER] }), NOW).kind,
    ).toBe("substitute");
  });

  describe("escalates to the absent approver's Approver ID", () => {
    const escalated = { kind: "escalated", userId: MANAGEMENT, from: APPROVER };

    it("when no substitute is set", () => {
      const approvers = chain({
        approver: { ...away, substituteUserId: null },
      });
      expect(deciderFor(REQUESTER, approvers, NOW)).toEqual(escalated);
    });

    it("when the substitute is away too", () => {
      const approvers = chain({ approver: away, substitute: away });
      expect(deciderFor(REQUESTER, approvers, NOW)).toEqual(escalated);
    });

    it("when the approver names themselves as their own substitute", () => {
      const approvers = chain({
        approver: { ...away, substituteUserId: APPROVER },
      });
      expect(deciderFor(REQUESTER, approvers, NOW)).toEqual(escalated);
    });

    it("when the substitute has no approval setup", () => {
      const approvers = chain({ approver: away, missing: [SUBSTITUTE] });
      expect(deciderFor(REQUESTER, approvers, NOW)).toEqual(escalated);
    });

    it("when the substitute is disabled", () => {
      const approvers = chain({ approver: away, disabled: [SUBSTITUTE] });
      expect(deciderFor(REQUESTER, approvers, NOW)).toEqual(escalated);
    });
  });

  describe("finds nobody", () => {
    it("when the requester has no approval setup or no approver", () => {
      expect(
        deciderFor(REQUESTER, chain({ missing: [REQUESTER] }), NOW).kind,
      ).toBe("none");
      const noApprover = new Map(chain());
      noApprover.set(REQUESTER, {
        setup: setup(REQUESTER),
        disabled: false,
      });
      expect(deciderFor(REQUESTER, noApprover, NOW).kind).toBe("none");
    });

    it("when the approver has no approval setup", () => {
      expect(
        deciderFor(REQUESTER, chain({ missing: [APPROVER] }), NOW).kind,
      ).toBe("none");
    });

    it("when the approver, their substitute and the escalation are all away", () => {
      const approvers = chain({
        approver: away,
        substitute: away,
        management: away,
      });
      expect(deciderFor(REQUESTER, approvers, NOW).kind).toBe("none");
    });

    it("when the absent approver escalates to themselves", () => {
      const approvers = chain({
        approver: { ...away, substituteUserId: null, approverId: APPROVER },
      });
      expect(deciderFor(REQUESTER, approvers, NOW).kind).toBe("none");
    });
  });
});

describe("a request is never handed back to its requester (F-4)", () => {
  it("passes over a substitute who raised the request, to the escalation", () => {
    const approvers = chain({
      approver: away,
      substitute: { approverId: APPROVER },
    });
    expect(deciderFor(SUBSTITUTE, approvers, NOW)).toEqual({
      kind: "escalated",
      userId: MANAGEMENT,
      from: APPROVER,
    });
  });

  it("finds nobody, and says why, when the escalation is the requester", () => {
    const approvers = chain({
      approver: away,
      substitute: away,
      management: { approverId: APPROVER },
    });
    const decider = deciderFor(MANAGEMENT, approvers, NOW);
    expect(decider.kind).toBe("none");
    expect(decider.kind === "none" && decider.reason).toContain(
      "raised the request",
    );
  });

  it("names the escalation, not the requester, as the one who decides", () => {
    const approvers = chain({
      approver: away,
      substitute: { approverId: APPROVER },
    });
    const refusal = new ApprovalRouteRule().refusal(
      context(SUBSTITUTE, { requesterUserId: SUBSTITUTE, approvers }),
    );
    expect(refusal).toContain(MANAGEMENT);
  });
});

describe("the approval route rule", () => {
  const rule = new ApprovalRouteRule();

  it("has no objection to an action that needs no approval", () => {
    expect(rule.refusal(plain(STRANGER))).toBeNull();
  });

  it("refuses an approval that does not say who raised the request", () => {
    expect(
      rule.refusal(context(APPROVER, { requesterUserId: undefined })),
    ).not.toBeNull();
  });

  it("lets the decider act, and refuses anyone else, naming who decides", () => {
    expect(rule.refusal(context(APPROVER))).toBeNull();
    expect(rule.refusal(context(STRANGER))).toContain(APPROVER);
    expect(rule.refusal(context(SUBSTITUTE))).toContain(APPROVER);
  });

  it("moves the decision to the substitute while the approver is away", () => {
    const approvers = chain({ approver: away });
    expect(rule.refusal(context(SUBSTITUTE, { approvers }))).toBeNull();
    expect(rule.refusal(context(APPROVER, { approvers }))).toContain(
      SUBSTITUTE,
    );
  });

  it("moves the decision to Management when the substitute is away too", () => {
    const approvers = chain({ approver: away, substitute: away });
    expect(rule.refusal(context(MANAGEMENT, { approvers }))).toBeNull();
    expect(rule.refusal(context(SUBSTITUTE, { approvers }))).toContain(
      MANAGEMENT,
    );
  });

  it("refuses everyone when nobody may decide", () => {
    const approvers = chain({
      approver: away,
      substitute: away,
      management: away,
    });
    for (const actor of [APPROVER, SUBSTITUTE, MANAGEMENT]) {
      expect(rule.refusal(context(actor, { approvers })), actor).not.toBeNull();
    }
  });
});
