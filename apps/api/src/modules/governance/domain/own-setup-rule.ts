import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

/**
 * Nobody changes their own approval limits or substitute, even holding
 * roles.manage: a person who could raise their own limit, or name who stands
 * in for them, would set the terms of their own approvals.
 */
export class OwnSetupRule implements PolicyRule {
  readonly name = "own-setup";

  refusal({ actor, action, resource }: PolicyContext): string | null {
    const ownSetup =
      action === "approval-setup.change" &&
      resource?.type === "ApprovalUserSetup" &&
      resource.id === actor.userId;
    return ownSetup
      ? "nobody changes their own approval limits or substitute"
      : null;
  }
}
