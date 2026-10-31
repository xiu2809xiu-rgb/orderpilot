import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { COOKIES, HEADERS } from "@orderpilot/shared";
import type { Request } from "express";
import { DomainError } from "../../common/domain-error.js";
import { AuthAuditor } from "../auth-auditor.js";
import type { AuthedRequest } from "../auth-context.js";
import { readCookie } from "../auth-cookies.js";
import { SKIP_CSRF_KEY } from "../decorators.js";
import { CsrfTokens } from "../domain/csrf-token.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF protection on every unsafe method. The op_csrf cookie and
 * the X-CSRF-Token header must match and carry our signature. It runs after
 * the auth guard, so an anonymous caller gets 401 first. Only the two routes
 * that start a session are exempt (@SkipCsrf), since no session exists yet.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CsrfTokens) private readonly csrf: CsrfTokens,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (
      this.reflector.get<boolean | undefined>(
        SKIP_CSRF_KEY,
        context.getHandler(),
      )
    ) {
      return true;
    }

    const cookie = readCookie(req, COOKIES.csrf);
    const header = req.get(HEADERS.csrf);
    if (this.csrf.verify(cookie, header)) return true;

    // Only a caller that holds a session or a refresh cookie is worth an
    // audit line; a bare POST with no cookies at all is just noise.
    if (req.auth || readCookie(req, COOKIES.refresh)) {
      await this.refuse(req, cookie, header);
    }
    throw new DomainError(
      "CSRF_INVALID",
      "The request did not carry a valid CSRF token.",
    );
  }

  private refuse(
    req: AuthedRequest,
    cookie: string | undefined,
    header: string | undefined,
  ): Promise<void> {
    return this.auditor.refused(req as Request, {
      action: "auth.csrf.refused",
      reason: !cookie
        ? "no-csrf-cookie"
        : !header
          ? "no-csrf-header"
          : "csrf-mismatch",
      summary: "A request without a valid CSRF token was refused",
      ...(req.auth ? { user: req.auth.user } : {}),
    });
  }
}
