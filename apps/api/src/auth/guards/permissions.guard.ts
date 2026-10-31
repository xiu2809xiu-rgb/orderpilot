import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@orderpilot/shared";
import type { Request } from "express";
import { DomainError } from "../../common/domain-error.js";
import { AuthAuditor } from "../auth-auditor.js";
import type { AuthedRequest } from "../auth-context.js";
import { PermissionPolicy } from "../permission-policy.js";
import { accessOf } from "./classification.js";

/**
 * Asks the PermissionPolicy about every @RequirePermission route. A route with
 * no decorator at all is refused too (deny by default), so forgetting one is
 * caught the first time the route is called. Every refusal is audited.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionPolicy) private readonly policy: PermissionPolicy,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access = accessOf(this.reflector, context);
    if (access.kind === "public" || access.kind === "authenticated") {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = req.auth;
    // The auth guard ran first. No user here means it was not registered.
    if (!auth) throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");

    if (access.kind === "unclassified") {
      await this.refuse(req, auth.user, "route-has-no-access-rule");
      throw forbidden();
    }
    for (const permission of access.permissions) {
      const decision = await this.policy.decide({
        user: auth.user,
        permission,
        method: req.method,
        path: req.path,
        params: req.params as Record<string, string | undefined>,
      });
      if (!decision.allowed) {
        await this.refuse(
          req,
          auth.user,
          decision.reason ?? "not-allowed",
          permission,
        );
        throw forbidden();
      }
    }
    return true;
  }

  private refuse(
    req: Request,
    user: NonNullable<AuthedRequest["auth"]>["user"],
    reason: string,
    permission?: Permission,
  ): Promise<void> {
    return this.auditor.refused(req, {
      action: "auth.permission.refused",
      reason,
      summary: `${user.displayName} was refused ${req.method} ${req.path}`,
      user,
      ...(permission ? { changes: { permission } } : {}),
    });
  }
}

function forbidden(): DomainError {
  return new DomainError("FORBIDDEN", "You do not have access to this.");
}
