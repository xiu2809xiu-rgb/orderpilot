import type { Permission } from "@orderpilot/shared";
import type { AuthUser } from "./auth-context.js";

/** What the permissions guard asks about one request. */
export interface AccessRequest {
  readonly user: AuthUser;
  readonly permission: Permission;
  /** For policies that look at the target: the route, as the caller sent it. */
  readonly method: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string | undefined>>;
}

export interface AccessDecision {
  readonly allowed: boolean;
  /** Written to the audit trail with a refusal. Never shown to the caller. */
  readonly reason?: string;
}

/**
 * Decides whether a signed-in user may use a permission. AuthModule provides
 * area 4's GovernancePermissionPolicy (F-3) under this token, so the guard asks
 * the same rules an area's own enforce() does. MatrixPermissionPolicy applies
 * the matrix alone and stays as the plain fallback. No controller changes when
 * the policy does, because controllers only say `@RequirePermission(...)`.
 */
export abstract class PermissionPolicy {
  abstract decide(request: AccessRequest): Promise<AccessDecision>;
}
