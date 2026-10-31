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
import { AppConfig } from "../../config/app-config.js";
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
 * that start a session are exempt from the token (@SkipCsrf), since no session
 * exists yet, but not from login CSRF: a hostile page could otherwise submit a
 * plain HTML form and swap a signed-in victim's session for the attacker's.
 * So those routes take only application/json, which a cross-site form cannot
 * send without a CORS preflight, and refuse an Origin that is not ours.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CsrfTokens) private readonly csrf: CsrfTokens,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
    @Inject(AppConfig) private readonly config: AppConfig,
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
      await this.requireJsonFromOurOrigin(req);
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

  private async requireJsonFromOurOrigin(req: AuthedRequest): Promise<void> {
    const type = req.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (type !== "application/json") {
      await this.refuseSessionStart(req, "not-json");
      throw new DomainError(
        "CSRF_INVALID",
        "Sign-in accepts application/json only.",
      );
    }
    const origin = req.get("origin");
    if (origin === undefined) return;
    const sameHost = (() => {
      try {
        return new URL(origin).host === req.get("host");
      } catch {
        return false;
      }
    })();
    if (sameHost || this.config.http.corsOrigins.includes(origin)) return;
    await this.refuseSessionStart(req, "foreign-origin");
    throw new DomainError(
      "CSRF_INVALID",
      "Sign-in from this origin is not allowed.",
    );
  }

  private refuseSessionStart(
    req: AuthedRequest,
    reason: string,
  ): Promise<void> {
    return this.auditor.refused(req as Request, {
      action: "auth.csrf.refused",
      reason,
      summary: "A sign-in that could be a forged form was refused",
      sampled: true,
    });
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
      ...(req.auth ? { user: req.auth.user } : { sampled: true }),
    });
  }
}
