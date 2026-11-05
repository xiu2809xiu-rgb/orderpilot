import { compareDecimal } from "@orderpilot/shared";
import { deciderFor } from "./approval-route.js";
import type {
  ApprovalFacts,
  PolicyContext,
  PolicyRule,
} from "./authorisation-policy.js";

/**
 * Whose limits a substitute approves with while the approver is away: their
 * "own", or the absent "approver"'s. "own" was decided on 3 Nov 2026 and is
 * still being confirmed (the F-3 ADR); the shared contract's comment describes
 * the approver's. Flip it here and nothing else changes; a test covers both.
 */
export type SubstituteLimits = "own" | "approver";
export const SUBSTITUTE_LIMITS: SubstituteLimits = "own";

/**
 * The amount must be within the decider's Sales or Purchase Amount Approval
 * Limit, unless their Unlimited flag for that kind is set. Exactly at the
 * limit is within it.
 */
export class ApprovalLimitRule implements PolicyRule {
  readonly name = "approval-limit";

  constructor(
    private readonly substituteLimits: SubstituteLimits = SUBSTITUTE_LIMITS,
  ) {}

  refusal({ actor, approval }: PolicyContext): string | null {
    if (!approval) return null;
    const { amount, limit } = approval;
    if (amount === undefined) return "an approval needs the amount at stake";
    if (compareDecimal(amount, "0") < 0) return "the amount is below zero";

    const holder = this.limitHolder(actor.userId, approval);
    const setup = approval.approvers.get(holder)?.setup;
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

  /** Whose setup holds the limit: the actor's, unless a substitute borrows the approver's. */
  private limitHolder(actorUserId: string, approval: ApprovalFacts): string {
    if (
      this.substituteLimits === "own" ||
      approval.requesterUserId === undefined
    ) {
      return actorUserId;
    }
    const decider = deciderFor(
      approval.requesterUserId,
      approval.approvers,
      approval.now,
    );
    return decider.kind === "substitute" && decider.userId === actorUserId
      ? decider.standsInFor
      : actorUserId;
  }
}
