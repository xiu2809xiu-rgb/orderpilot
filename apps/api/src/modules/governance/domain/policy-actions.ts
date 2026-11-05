import type { Permission } from "@orderpilot/shared";

/** Which Navision approval limit an action is checked against. */
export type LimitKind = "sales" | "purchase";

export interface PolicyAction {
  readonly permission: Permission;
  readonly limit: LimitKind;
}

/**
 * The actions an area asks the policy about before it acts, the permission
 * each needs and the limit it is checked against. Configuration until Spectra
 * confirms its approvers and limits (A-14).
 */
const POLICY_ACTIONS: Readonly<Record<string, PolicyAction>> = {
  "spr.approve": { permission: "approvals.decide", limit: "purchase" },
  "purchase-order.approve": {
    permission: "approvals.decide",
    limit: "purchase",
  },
  // A placeholder: what a sales approval is at Spectra is not known yet (A-19).
  "sales-order.approve": { permission: "approvals.decide", limit: "sales" },
};

/** The action by name, or undefined for one the policy does not know. */
export function policyActionOf(name: string): PolicyAction | undefined {
  // Object.hasOwn, so "toString" or "__proto__" is never mistaken for an action.
  return Object.hasOwn(POLICY_ACTIONS, name) ? POLICY_ACTIONS[name] : undefined;
}
