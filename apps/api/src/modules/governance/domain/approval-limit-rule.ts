import { compareDecimal } from "@orderpilot/shared";
import { deciderFor } from "./approval-route.js";
import type { ApprovalSetup } from "./approval-setup.js";
import type {
  ApprovalFacts,
  PolicyContext,
  PolicyRule,
} from "./authorisation-policy.js";
import type { LimitKind } from "./policy-actions.js";

/**
 * Whose limits a substitute approves with while the approver is away: their
 * "own", or the absent "approver"'s. "own" was decided on 3 Nov 2026 and is
 * still being confirmed (the F-3 ADR); the shared contract's comment describes
 * the approver's. Flip it here and nothing else changes; a test covers both.
 */
export type SubstituteLimits = "own" | "approver";
export const SUBSTITUTE_LIMITS: SubstituteLimits = "own";

/**
 * Why `setup` does not cover `amount` for this kind of limit, or null when it
 * does: within the Sales or Purchase Amount Approval Limit, exactly at it
 * included, or the Unlimited flag for that kind. The limit rule and the
 * approver group (#252) both ask this, so they never disagree.
 */
export function limitRefusal(
  setup: ApprovalSetup | undefined,
  limit: LimitKind,
  amount: string,
): string | null {
  if (compareDecimal(amount, "0") < 0) return "the amount is below zero";
  if (!setup) return "the approver has no approval setup";
  const [unlimited, ceiling] =
    limit === "sales"
      ? [setup.unlimitedSalesApproval, setup.salesAmountApprovalLimit]
      : [setup.unlimitedPurchaseApproval, setup.purchaseAmountApprovalLimit];
  if (unlimited) return null;
  return compareDecimal(amount, ceiling) > 0
    ? `the amount is over the ${limit} approval limit of ${ceiling}`
    : null;
}

/**
 * The amount must be within the decider's own limit, while limits are on.
 * They are switchable, with none set, until Spectra confirms them (ADR 0049,
 * ADR 0054): while they are off, no amount is too large, though an approval
 * still needs one, and it is never below zero.
 */
export class ApprovalLimitRule implements PolicyRule {
  readonly name = "approval-limit";

  constructor(
    private readonly substituteLimits: SubstituteLimits = SUBSTITUTE_LIMITS,
  ) {}

  refusal({ actor, approval, requesterUserId }: PolicyContext): string | null {
    if (!approval) return null;
    const { amount, limit } = approval;
    if (amount === undefined) return "an approval needs the amount at stake";
    if (compareDecimal(amount, "0") < 0) return "the amount is below zero";
    if (!approval.limitsOn) return null;

    const holder = this.limitHolder(actor.userId, requesterUserId, approval);
    return limitRefusal(approval.approvers.get(holder)?.setup, limit, amount);
  }

  /** Whose setup holds the limit: the actor's, unless a substitute borrows the approver's. */
  private limitHolder(
    actorUserId: string,
    requesterUserId: string | undefined,
    approval: ApprovalFacts,
  ): string {
    if (this.substituteLimits === "own" || requesterUserId === undefined) {
      return actorUserId;
    }
    const decider = deciderFor(
      requesterUserId,
      approval.approvers,
      approval.now,
    );
    return decider.kind === "substitute" && decider.userId === actorUserId
      ? decider.standsInFor
      : actorUserId;
  }
}
