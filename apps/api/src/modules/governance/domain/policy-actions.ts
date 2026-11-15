import type { Permission } from "@orderpilot/shared";

/** Which Business Central approval limit an action is checked against. */
export type LimitKind = "sales" | "purchase";

export interface PolicyAction {
  readonly permission: Permission;
  /** The limit an approval is checked against. Absent for an action with no limit. */
  readonly limit?: LimitKind;
}

/**
 * The actions an area asks the policy about before it acts, the permission
 * each needs and, for an approval, the limit it is checked against.
 * Configuration until Spectra confirms its approvers and limits (A-14).
 */
const POLICY_ACTIONS: Readonly<Record<string, PolicyAction>> = {
  "spr.approve": { permission: "approvals.decide", limit: "purchase" },
  // The coordinator routes an SPR to the approver group and hands it back
  // (#252). Routing decides nothing, so it has no limit.
  "spr.route": { permission: "spr.route" },
  "purchase-order.approve": {
    permission: "approvals.decide",
    limit: "purchase",
  },
  // A placeholder: what a sales approval is at Spectra is not known yet (A-19).
  "sales-order.approve": { permission: "approvals.decide", limit: "sales" },
  "approval-setup.change": { permission: "roles.manage" },
  // A customer's payment arriving and a payment going out to a vendor are
  // different duties, so they are different actions.
  "customer-payment.confirm": { permission: "payments.confirm" },
  // Two permissions, so a hold's two people come from two different roles: Finance
  // verifies, and a management approver clears (F-5).
  "payment-hold.verify": { permission: "payments.confirm" },
  "payment-hold.clear": { permission: "approvals.decide" },
  "vendor-payment.approve": { permission: "payments.post" },
  "vendor-payment.release": { permission: "payments.post" },
};

/** The action by name, or undefined for one the policy does not know. */
export function policyActionOf(name: string): PolicyAction | undefined {
  // Object.hasOwn, so "toString" or "__proto__" is never mistaken for an action.
  return Object.hasOwn(POLICY_ACTIONS, name) ? POLICY_ACTIONS[name] : undefined;
}
