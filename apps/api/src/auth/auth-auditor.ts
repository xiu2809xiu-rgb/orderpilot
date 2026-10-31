import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuditActor } from "@orderpilot/shared";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service.js";
import { requestIdOf } from "../common/request-id.js";
import type { AuthUser } from "./auth-context.js";

export interface Refusal {
  /** `auth.<what>.refused`, such as "auth.login.refused". */
  readonly action: string;
  readonly reason: string;
  readonly summary: string;
  /** The user the refusal is about, when known. */
  readonly entity?: { type: string; id: string };
  /** Who was refused, when a signed-in user was. Otherwise the actor is the system's auth layer. */
  readonly user?: AuthUser;
  readonly changes?: Record<string, unknown>;
}

/**
 * Writes the audit event of a refused request: a bad sign-in, a refused
 * permission, a failed CSRF check, a reused refresh token. A refusal changes
 * nothing, so it is audited on its own, outside any business transaction. If
 * the audit write fails, the caller is still refused and the failure is logged.
 *
 * What is not audited, so an anonymous caller cannot flood the trail: a call
 * to a protected route with no session cookie, and one whose access token has
 * expired (the web app refreshes silently, so that is routine). Both are in
 * the request log. ADR 0012 states the rule.
 */
@Injectable()
export class AuthAuditor {
  private readonly logger = new Logger(AuthAuditor.name);

  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async refused(req: Request, refusal: Refusal): Promise<void> {
    const actor: AuditActor = refusal.user
      ? { kind: "user", userId: refusal.user.id, role: refusal.user.role }
      : { kind: "system", name: "auth" };
    try {
      await this.audit.record({
        actor,
        action: refusal.action,
        entityType: refusal.entity?.type ?? "ApiRoute",
        entityId: refusal.entity?.id ?? `${req.method} ${req.path}`,
        summary: refusal.summary,
        changes: { reason: refusal.reason, ...refusal.changes },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
    } catch (error) {
      this.logger.error(
        { traceId: requestIdOf(req), err: error },
        "Could not audit a refusal",
      );
    }
  }
}
