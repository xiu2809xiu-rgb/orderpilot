import { ApprovalLimitRule } from "./approval-limit-rule.js";
import { ApprovalRouteRule } from "./approval-route.js";
import { AuthorisationPolicy } from "./authorisation-policy.js";
import { NoSelfApprovalRule } from "./no-self-approval-rule.js";
import { OwnSetupRule } from "./own-setup-rule.js";
import { PermissionRule, SystemAdminRule } from "./policy-rules.js";
import { SegregationOfDutiesRule } from "./segregation-of-duties.js";

/** What the permissions guard runs on every @RequirePermission route. */
export const ROUTE_POLICY = new AuthorisationPolicy([
  new SystemAdminRule(),
  new PermissionRule(),
]);

/**
 * What an area runs before it acts. The first refusal wins, so the order is
 * the order of the reasons:
 * - the system admin's promise, then the permission, come before anything;
 * - who the actor is to this record (they raised it, it is their own setup,
 *   they did an earlier duty on it) comes before the approval chain, so no
 *   substitute, escalation or limit can outweigh it;
 * - the route, then the limit, are checked only for someone who may act at
 *   all, and the limit only for the person the chain names.
 */
export const ACTION_POLICY = new AuthorisationPolicy([
  new SystemAdminRule(),
  new PermissionRule(),
  new NoSelfApprovalRule(),
  new OwnSetupRule(),
  new SegregationOfDutiesRule(),
  new ApprovalRouteRule(),
  new ApprovalLimitRule(),
]);
