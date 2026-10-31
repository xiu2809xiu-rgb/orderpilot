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
 * Decides whether a signed-in user may use a permission. The default asks the
 * role-permission matrix (MatrixPermissionPolicy). F-1 and F-3 put a richer
 * policy behind this one class (approval limits, segregation of duties, data
 * scope) by providing their own under this token in AppModule; no controller
 * changes, because controllers only say `@RequirePermission(...)`.
 */
export abstract class PermissionPolicy {
  abstract decide(request: AccessRequest): Promise<AccessDecision>;
}
