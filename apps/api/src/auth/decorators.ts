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
export const SKIP_CSRF_KEY = "op:skip-csrf";
export const STRICT_RATE_LIMIT_KEY = "op:strict-rate-limit";

/**
 * The guards: every route needs one of these three, or it is refused.
 *
 *   @Public()                   no session needed (health, sign-in, docs)
 *   @Authenticated()            any signed-in user (their own profile)
 *   @RequirePermission("x.y")   a signed-in user whose role holds x.y
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
