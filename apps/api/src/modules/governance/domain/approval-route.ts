import { isAway, type Approver } from "./approval-setup.js";
import { isInGroup } from "./approver-group.js";
import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

/** Who may decide a request, and why it is them. */
export type Decider =
  | { readonly kind: "approver"; readonly userId: string }
  | {
      readonly kind: "substitute";
      readonly userId: string;
      readonly standsInFor: string;
    }
  | {
      readonly kind: "escalated";
      readonly userId: string;
      readonly from: string;
    }
  | { readonly kind: "none"; readonly reason: string };

/** Someone a request can be routed to: set up, enabled and not away. */
function isAvailable(approver: Approver | undefined, now: Date): boolean {
  return (
    approver !== undefined && !approver.disabled && !isAway(approver.setup, now)
  );
}

/**
 * Who decides a request raised by `requesterUserId`, along Business Central's
 * approval chain. The requester's Approver ID decides. While they are away or
 * disabled, their substitute does. When the substitute is not set, is the
 * approver themselves, has no setup, is disabled or is away too, the request
 * escalates to the absent approver's own Approver ID. One level only: if that
 * person cannot act either, nobody may decide, rather than the request reaching
 * someone the setup never named.
 *
 * The requester is never handed their own request (F-4): wherever they appear
 * on the chain, they are passed over like someone away, and the request moves
 * on. The no-self-approval rule still refuses them if they act anyway.
 *
 * Deprecated since #252: once APPROVER_GROUP is on, any one of the approver
 * group decides and the approval-route rule stops reading this chain. Area 2
 * then routes with `AuthorisationService.approversFor` (#251). Until then it
 * works unchanged; the follow-up removes it with substitutes and away dates.
 * (In words, not a JSDoc tag: the tag would fail lint at area 2's call sites.)
 */
export function deciderFor(
  requesterUserId: string,
  approvers: ReadonlyMap<string, Approver>,
  now: Date,
): Decider {
  const approverId = approvers.get(requesterUserId)?.setup.approverId ?? null;
  if (approverId === null) {
    return {
      kind: "none",
      reason: "nobody is set up to approve this requester's requests",
    };
  }
  const approver = approvers.get(approverId);
  if (!approver) {
    return {
      kind: "none",
      reason: "the requester's approver has no approval setup",
    };
  }
  const canDecide = (userId: string | null): userId is string =>
    userId !== null &&
    userId !== requesterUserId &&
    isAvailable(approvers.get(userId), now);
  if (canDecide(approverId)) return { kind: "approver", userId: approverId };

  // A row naming the approver as their own substitute, or as the person they
  // escalate to, needs no check of its own: that person is the absent approver,
  // never available, so the request moves on up the chain.
  const { substituteUserId, approverId: escalatesTo } = approver.setup;
  if (canDecide(substituteUserId)) {
    return {
      kind: "substitute",
      userId: substituteUserId,
      standsInFor: approverId,
    };
  }
  if (canDecide(escalatesTo)) {
    return { kind: "escalated", userId: escalatesTo, from: approverId };
  }
  const onTheChain: readonly (string | null)[] = [
    approverId,
    substituteUserId,
    escalatesTo,
  ];
  const passedOver = onTheChain.includes(requesterUserId);
  return {
    kind: "none",
    reason: passedOver
      ? "nobody else on the chain can act, and the one who could raised the request"
      : "the approver cannot act, and neither can their substitute or the person they escalate to",
  };
}

const WHO: Record<Exclude<Decider["kind"], "none">, string> = {
  approver: "the requester's approver",
  substitute: "the absent approver's substitute",
  escalated: "the person the absent approver escalates to",
};

/**
 * Who may decide an approval. While APPROVER_GROUP is on (#252, ADR 0054),
 * any one member of the approver group: every enabled management approver
 * except the requester. Nobody else may, Management included, and absence
 * moves nothing. While it is off, the default until area 2 routes with the
 * group (#251), only the person the old chain names, exactly as before.
 */
export class ApprovalRouteRule implements PolicyRule {
  readonly name = "approval-route";

  refusal({ actor, approval, requesterUserId }: PolicyContext): string | null {
    if (!approval) return null;
    if (requesterUserId === undefined) {
      return "an approval needs the person who raised the request";
    }
    if (approval.groupDecides) {
      if (isInGroup(approval.group, actor.userId)) return null;
      return (
        approval.group.reason ??
        "only a management approver who did not raise the request may decide it"
      );
    }
    // The old chain, temporary: the follow-up to #251 removes it.
    const decider = deciderFor(
      requesterUserId,
      approval.approvers,
      approval.now,
    );
    if (decider.kind === "none") return decider.reason;
    return decider.userId === actor.userId
      ? null
      : `only ${WHO[decider.kind]} (${decider.userId}) may decide this request`;
  }
}
