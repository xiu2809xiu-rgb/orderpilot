import type {
  Permission,
  PolicyDecision,
  PolicyRequest,
} from "@orderpilot/shared";
import type { Approver } from "./approval-setup.js";
import type { HoldClearanceFacts, VendorHoldFacts } from "./bank-hold-rules.js";
import type { LimitKind } from "./policy-actions.js";
import type { EarlierDuties } from "./segregation-of-duties.js";

/**
 * Everything a rule may read about one request: who asks, to do what, on which
 * record, who raised it and who did its earlier duties, and, for an approval,
 * the amount and the approval setups on the requester's chain. The service
 * gathers it; the rules only read it, so each one is a plain unit test.
 */
export interface PolicyContext {
  readonly actor: PolicyRequest["actor"];
  /** The action asked about, such as "spr.approve". */
  readonly action: string;
  readonly permission: Permission;
  /** Whether the actor's role holds the permission in the role-permission matrix. */
  readonly roleHoldsPermission: boolean;
  readonly resource?: PolicyRequest["resource"];
  /** Who raised the request, from the caller's stored record. */
  readonly requesterUserId?: string | undefined;
  /** Who did each earlier duty on this record, from the caller's stored records. */
  readonly earlierDuties?: EarlierDuties | undefined;
  /** Present only when the action is an approval with a limit. */
  readonly approval?: ApprovalFacts;
  /** Present only for a payment to a vendor. */
  readonly vendorHold?: VendorHoldFacts;
  /** Present only for a step on a bank-detail hold. */
  readonly holdClearance?: HoldClearanceFacts;
}

export interface ApprovalFacts {
  readonly limit: LimitKind;
  readonly amount: string | undefined;
  /** The setups the rules may need, by user id. */
  readonly approvers: ReadonlyMap<string, Approver>;
  readonly now: Date;
}

/** One rule in the chain. Each rule is one reason a request may be refused. */
export interface PolicyRule {
  /** Names the rule in a decision and in the audit trail, such as "approval-limit". */
  readonly name: string;
  /** Why the rule refuses, or null when it has no objection. */
  refusal(context: PolicyContext): string | null;
}

/**
 * The authorisation policy: the rules run in order, and the first refusal wins
 * with its rule and reason. A request is allowed only when no rule objects.
 */
export class AuthorisationPolicy {
  constructor(private readonly rules: readonly PolicyRule[]) {}

  decide(context: PolicyContext): PolicyDecision {
    for (const rule of this.rules) {
      const reason = rule.refusal(context);
      if (reason !== null) {
        return { outcome: "refused", rule: rule.name, reason };
      }
    }
    return { outcome: "allowed", rule: "policy", reason: "no rule objects" };
  }
}
