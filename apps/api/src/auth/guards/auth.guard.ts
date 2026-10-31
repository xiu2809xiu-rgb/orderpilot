import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { COOKIES } from "@orderpilot/shared";
import type { Request } from "express";
import { DomainError } from "../../common/domain-error.js";
import { AppConfig } from "../../config/app-config.js";
import { RefreshTokenRepository } from "../../sessions/refresh-token.repository.js";
import { UserRepository } from "../../users/user.repository.js";
import { AuthAuditor } from "../auth-auditor.js";
import type { AuthedRequest } from "../auth-context.js";
import { readCookie } from "../auth-cookies.js";
import { AccessTokens } from "../domain/access-token.js";
import { accessOf } from "./classification.js";

/**
 * Deny by default: every route needs a signed-in user unless it says @Public().
 * It reads the access cookie, verifies the JWT (HS256 only), then loads the user
 * and checks the sign-in is still live, so a disabled user, a signed-out
 * session and a revoked family all stop at their next request, not when the
 * token runs out.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessTokens) private readonly access: AccessTokens,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(RefreshTokenRepository)
    private readonly tokens: RefreshTokenRepository,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (accessOf(this.reflector, context).kind === "public") return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const presented = readCookie(req, COOKIES.access);
    // No cookie at all: an anonymous caller. Refused, not audited (ADR 0012).
    if (!presented) throw unauthenticated();

    const verdict = await this.access.verify(presented);
    // Expired is routine: the web app refreshes. Not audited.
    if (verdict.kind === "expired") {
      throw new DomainError(
        "SESSION_EXPIRED",
        "Your session has expired. Refresh it or sign in again.",
      );
    }
    if (verdict.kind === "invalid") {
      await this.refuse(req, "invalid-token", undefined, true);
      throw unauthenticated();
    }

    const { claims } = verdict;
    const user = await this.users.findById(claims.userId);
    if (user?.disabledAt !== null) {
      await this.refuse(req, user ? "user-disabled" : "unknown-user", user?.id);
      throw unauthenticated();
    }
    // A sign-in taken with no password must not outlive the switch.
    if (claims.demo && !this.config.demoMode) {
      await this.refuse(req, "demo-mode-off", user.id);
      throw unauthenticated();
    }
    if (!(await this.tokens.hasLiveToken(claims.sessionId, user.id))) {
      await this.refuse(req, "session-ended", user.id);
      throw new DomainError(
        "SESSION_EXPIRED",
        "Your session has ended. Sign in again.",
      );
    }

    req.auth = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      demo: claims.demo,
      sessionId: claims.sessionId,
      expiresAt: claims.expiresAt,
    };
    return true;
  }

  private refuse(
    req: Request,
    reason: string,
    userId?: string,
    sampled = false,
  ): Promise<void> {
    return this.auditor.refused(req, {
      action: "auth.access.refused",
      reason,
      summary: "A request with a session that is not valid was refused",
      ...(userId ? { entity: { type: "User", id: userId } } : {}),
      ...(sampled ? { sampled } : {}),
    });
  }
}

function unauthenticated(): DomainError {
  return new DomainError("UNAUTHENTICATED", "Sign in to continue.");
}
