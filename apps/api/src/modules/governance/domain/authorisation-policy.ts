import type {
  Permission,
  PolicyDecision,
  PolicyRequest,
} from "@orderpilot/shared";
import type { Approver } from "./approval-setup.js";
import type { LimitKind } from "./policy-actions.js";

/**
 * Everything a rule may read about one request: who asks, for which
 * permission, and, for an approval, the amount, the requester and the
 * approval setups on the requester's chain. The service gathers it; the rules
 * only read it, so each one is a plain unit test.
 */
export interface PolicyContext {
  readonly actor: PolicyRequest["actor"];
  readonly permission: Permission;
  /** Whether the actor's role holds the permission in the role-permission matrix. */
  readonly roleHoldsPermission: boolean;
  /** Present only when the action is an approval with a limit. */
  readonly approval?: ApprovalFacts;
}

export interface ApprovalFacts {
  readonly limit: LimitKind;
  readonly amount: string | undefined;
  readonly requesterUserId: string | undefined;
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
