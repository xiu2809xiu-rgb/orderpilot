import { describe, expect, it } from "vitest";
import type { ApprovalSetup } from "./approval-setup.js";
import {
  approverGroup,
  type ApproverGroupQuestion,
  type GroupCandidate,
} from "./approver-group.js";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const REQUESTER = id(1);
const AMY = id(2);
const BEN = id(3);
const CAL = id(4);

function setup(
  userId: string,
  limits: Partial<ApprovalSetup> = {},
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
    ...limits,
  };
}

function candidate(
  userId: string,
  displayName: string,
  more: Partial<GroupCandidate> = {},
): GroupCandidate {
  return { userId, displayName, disabled: false, setup: null, ...more };
}

/** Three approvers, given out of name order on purpose. */
const three = (): GroupCandidate[] => [
  candidate(CAL, "Cal Tan"),
  candidate(AMY, "Amy Lim"),
  candidate(BEN, "Ben Ong"),
];

const ask = (
  more: Partial<ApproverGroupQuestion> = {},
): ApproverGroupQuestion => ({
  requesterUserId: REQUESTER,
  limit: "purchase",
  amount: "100.00",
  limitsOn: false,
  ...more,
});

describe("the approver group (#252)", () => {
  it("is every enabled approver, sorted by name, while limits are off", () => {
    expect(approverGroup(three(), ask())).toEqual({
      approvers: [
        { userId: AMY, displayName: "Amy Lim" },
        { userId: BEN, displayName: "Ben Ong" },
        { userId: CAL, displayName: "Cal Tan" },
      ],
      reason: null,
    });
  });

  it("never holds the requester, even when they are an approver", () => {
    const group = approverGroup(three(), ask({ requesterUserId: AMY }));
    expect(group.approvers.map((each) => each.userId)).toEqual([BEN, CAL]);
  });

  it("leaves out a disabled approver, and keeps one who is away", () => {
    const away = setup(BEN, {
      awayFrom: new Date("2026-11-01T00:00:00.000Z"),
      awayUntil: null,
    });
    const group = approverGroup(
      [
        candidate(AMY, "Amy Lim", { disabled: true }),
        candidate(BEN, "Ben Ong", { setup: away }),
        candidate(CAL, "Cal Tan"),
      ],
      ask(),
    );
    expect(group.approvers.map((each) => each.userId)).toEqual([BEN, CAL]);
  });

  it("holds each approver's id and name only, never an email or a setup", () => {
    const group = approverGroup(
      [candidate(AMY, "Amy Lim", { setup: setup(AMY) })],
      ask(),
    );
    for (const approver of group.approvers) {
      expect(Object.keys(approver).sort()).toEqual(["displayName", "userId"]);
    }
  });

  it("says why only when nobody is left", () => {
    expect(approverGroup(three(), ask()).reason).toBeNull();
    expect(approverGroup([], ask()).reason).toBe(
      "no management approver is enabled",
    );
    expect(
      approverGroup([candidate(AMY, "Amy Lim", { disabled: true })], ask())
        .reason,
    ).toBe("no management approver is enabled");
    expect(
      approverGroup(
        [
          candidate(AMY, "Amy Lim"),
          candidate(BEN, "Ben Ong", { disabled: true }),
        ],
        ask({ requesterUserId: AMY }),
      ),
    ).toEqual({
      approvers: [],
      reason: "the only enabled management approver raised the request",
    });
  });

  describe("with limits switched on", () => {
    const limited = (): GroupCandidate[] => [
      candidate(AMY, "Amy Lim", {
        setup: setup(AMY, { purchaseAmountApprovalLimit: "5000.00" }),
      }),
      candidate(BEN, "Ben Ong", {
        setup: setup(BEN, {
          purchaseAmountApprovalLimit: "3000.00",
          salesAmountApprovalLimit: "20000.00",
        }),
      }),
      candidate(CAL, "Cal Tan", {
        setup: setup(CAL, { unlimitedPurchaseApproval: true }),
      }),
    ];
    const ids = (question: Partial<ApproverGroupQuestion>) =>
      approverGroup(
        limited(),
        ask({ limitsOn: true, ...question }),
      ).approvers.map((each) => each.userId);

    it("keeps only the approvers whose limit covers the amount, exactly at it included", () => {
      expect(ids({ amount: "3000.00" })).toEqual([AMY, BEN, CAL]);
      expect(ids({ amount: "4000.00" })).toEqual([AMY, CAL]);
      expect(ids({ amount: "5000.00" })).toEqual([AMY, CAL]);
      expect(ids({ amount: "5000.01" })).toEqual([CAL]);
    });

    it("reads the limit of the action's kind", () => {
      expect(ids({ limit: "sales", amount: "15000.00" })).toEqual([BEN]);
    });

    it("leaves out an approver with no approval setup", () => {
      const group = approverGroup(
        [candidate(AMY, "Amy Lim")],
        ask({ limitsOn: true }),
      );
      expect(group.approvers).toEqual([]);
    });

    it("says the amount is over every limit when nobody's covers it", () => {
      const group = approverGroup(
        limited().slice(0, 2),
        ask({ limitsOn: true, amount: "9000.00" }),
      );
      expect(group).toEqual({
        approvers: [],
        reason: "the amount is over every approver's purchase approval limit",
      });
    });

    it("needs the amount at stake", () => {
      const group = approverGroup(
        limited(),
        ask({ limitsOn: true, amount: undefined }),
      );
      expect(group).toEqual({
        approvers: [],
        reason: "an approval needs the amount at stake",
      });
    });
  });
});
