import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

/**
 * Whoever raised a request never decides it, whatever their role, limit or
 * place on the approval chain: as the approver, as a substitute or through an
 * escalation. It compares user ids, never roles, so a change of role after
 * raising the request changes nothing.
 */
export class NoSelfApprovalRule implements PolicyRule {
  readonly name = "no-self-approval";

  refusal({ actor, requesterUserId }: PolicyContext): string | null {
    return requesterUserId === actor.userId
      ? "whoever raised a request never decides it"
      : null;
  }
}
