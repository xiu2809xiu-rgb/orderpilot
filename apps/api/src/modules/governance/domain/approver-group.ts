import { limitRefusal } from "./approval-limit-rule.js";
import type { ApprovalSetup } from "./approval-setup.js";
import type { LimitKind } from "./policy-actions.js";

/** Someone with the APPROVER role, as the service hands them over. Never an email. */
export interface GroupCandidate {
  readonly userId: string;
  readonly displayName: string;
  readonly disabled: boolean;
  /** Their approval setup, read only while limits are on. */
  readonly setup: ApprovalSetup | null;
}

/** Who raised the request, what is at stake, and whether limits apply. */
export interface ApproverGroupQuestion {
  readonly requesterUserId: string | undefined;
  readonly limit: LimitKind | undefined;
  readonly amount: string | undefined;
  readonly limitsOn: boolean;
}

/** One member of the group: the id to route to and the name to show. */
export interface GroupApprover {
  readonly userId: string;
  readonly displayName: string;
}

/** The approvers who may decide, and why nobody may, when nobody may. */
export interface ApproverGroup {
  readonly approvers: readonly GroupApprover[];
  /** Set only when `approvers` is empty. */
  readonly reason: string | null;
}

/**
 * The approver group (#252, ADR 0055): any one of Spectra's management
 * approvers decides, so there is no chain, no substitute and no escalation by
 * absence. The group is every enabled approver except the person who raised
 * the request. While limits are on, it keeps only those whose own limit
 * covers the amount. An approver who is away stays in: nobody stands in for
 * anyone any more.
 */
export function approverGroup(
  candidates: readonly GroupCandidate[],
  question: ApproverGroupQuestion,
): ApproverGroup {
  const enabled = candidates.filter((each) => !each.disabled);
  const others = enabled.filter(
    (each) => each.userId !== question.requesterUserId,
  );
  if (others.length === 0) {
    return {
      approvers: [],
      reason:
        enabled.length === 0
          ? "no management approver is enabled"
          : "the only enabled management approver raised the request",
    };
  }
  let covered = others;
  if (question.limitsOn && question.limit !== undefined) {
    if (question.amount === undefined) {
      return { approvers: [], reason: "an approval needs the amount at stake" };
    }
    const { limit, amount } = question;
    covered = others.filter(
      (each) => limitRefusal(each.setup ?? undefined, limit, amount) === null,
    );
    if (covered.length === 0) {
      return {
        approvers: [],
        reason: `the amount is over every approver's ${limit} approval limit`,
      };
    }
  }
  return {
    // The id and the name only: whatever else the caller passed stays here.
    approvers: covered
      .map(({ userId, displayName }) => ({ userId, displayName }))
      .sort(
        (a, b) =>
          a.displayName.localeCompare(b.displayName) ||
          a.userId.localeCompare(b.userId),
      ),
    reason: null,
  };
}

/** Whether `userId` is in the group. */
export function isInGroup(group: ApproverGroup, userId: string): boolean {
  return group.approvers.some((each) => each.userId === userId);
}
