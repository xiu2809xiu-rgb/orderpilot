import {
  SetMetadata,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import type { Permission } from "@orderpilot/shared";
import type { AuthContext, AuthedRequest } from "./auth-context.js";

export const PUBLIC_KEY = "op:public";
export const AUTHENTICATED_KEY = "op:authenticated";
export const PERMISSION_KEY = "op:permission";
export const PERMISSION_OF_KEY = "op:permission-of";
export const SKIP_CSRF_KEY = "op:skip-csrf";
export const STRICT_RATE_LIMIT_KEY = "op:strict-rate-limit";

/**
 * The guards: every route needs one of these, or it is refused.
 *
 *   @Public()                   no session needed (health, sign-in, docs)
 *   @Authenticated()            any signed-in user (their own profile)
 *   @RequirePermission("x.y")   a signed-in user whose role holds x.y
 *   @RequirePermissionOf(fn)    the same, with x.y named by the route's params
 *
 * Put it on the handler, or on the controller to cover all its routes. A
 * handler's decorator wins over its controller's.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PUBLIC_KEY, true);

export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_KEY, true);

/** Several names mean the caller needs all of them. */
export const RequirePermission = (
  ...permissions: [Permission, ...Permission[]]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSION_KEY, permissions);

/** Names the permission a request needs from its route params, or undefined when none fits. */
export type PermissionResolver = (
  params: Readonly<Record<string, string | undefined>>,
) => Permission | undefined;

/**
 * For a route whose permission depends on what it is asked about, such as a
 * record's operation log: reading a user's log needs `users.read`, an order's
 * `orders.read`. The guard asks the PermissionPolicy about the permission that
 * `resolve` names and audits a refusal, exactly as for @RequirePermission. A
 * request it names no permission for is refused (deny by default).
 */
export const RequirePermissionOf = (
  resolve: PermissionResolver,
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSION_OF_KEY, resolve);

/**
 * Exempts a POST from the CSRF check. Only for the two routes that start a
 * session, where no session cookie exists yet for a forged request to ride on.
 */
export const SkipCsrf = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_CSRF_KEY, true);

/** Counts the route against the stricter sign-in rate limit as well. */
export const StrictRateLimit = (): MethodDecorator & ClassDecorator =>
  SetMetadata(STRICT_RATE_LIMIT_KEY, true);

/** The caller, in a handler: `me(@Auth() auth: AuthContext)`. Only on routes behind the auth guard. */
export const Auth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
    if (!auth)
      throw new Error("@Auth() used on a route with no signed-in user");
    return auth;
  },
);
