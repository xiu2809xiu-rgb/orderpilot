import { ApprovalLimitRule } from "./approval-limit-rule.js";
import { ApprovalRouteRule } from "./approval-route.js";
import { AuthorisationPolicy } from "./authorisation-policy.js";
import { PermissionRule, SystemAdminRule } from "./policy-rules.js";

/** What the permissions guard runs on every @RequirePermission route. */
export const ROUTE_POLICY = new AuthorisationPolicy([
  new SystemAdminRule(),
  new PermissionRule(),
]);

/**
 * What an area runs before it acts on an approval. The first refusal wins, so
 * the order is the order of the reasons: a role without the permission is told
 * that, not that it is over a limit, and the limit is checked only for the
 * person the chain names.
 */
export const ACTION_POLICY = new AuthorisationPolicy([
  new SystemAdminRule(),
  new PermissionRule(),
  new ApprovalRouteRule(),
  new ApprovalLimitRule(),
]);
