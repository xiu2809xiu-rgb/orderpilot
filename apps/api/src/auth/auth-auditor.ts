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
  /**
   * The caller proved nothing (no valid session), so anyone can cause this
   * refusal. Written at most once a minute per client and action; the rest
   * are in the request log only.
   */
  readonly sampled?: boolean;
}

const SAMPLE_WINDOW_MS = 60_000;
const SAMPLE_MAX_KEYS = 10_000;
const MAX_ENTITY_ID = 200;

/**
 * Writes the audit event of a refused request: a bad sign-in, a refused
 * permission, a failed CSRF check, a reused refresh token. A refusal changes
 * nothing, so it is audited on its own, outside any business transaction. If
 * the audit write fails, the caller is still refused and the failure is logged.
 *
 * What is not audited, so an anonymous caller cannot flood the trail: a call
 * to a protected route with no session cookie, and one whose access token has
 * expired (the web app refreshes silently, so that is routine). Both are in
 * the request log. A refusal anyone can cause with junk (a forged token, a
 * forged CSRF header) is sampled: one row per client and action a minute.
 * ADR 0012 states the rule.
 */
@Injectable()
export class AuthAuditor {
  private readonly logger = new Logger(AuthAuditor.name);

  private readonly lastSampled = new Map<string, number>();

  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async refused(req: Request, refusal: Refusal): Promise<void> {
    if (refusal.sampled && !this.shouldSample(req, refusal.action)) return;
    const actor: AuditActor = refusal.user
      ? { kind: "user", userId: refusal.user.id, role: refusal.user.role }
      : { kind: "system", name: "auth" };
    try {
      await this.audit.record({
        actor,
        action: refusal.action,
        entityType: refusal.entity?.type ?? "ApiRoute",
        entityId: refusal.entity?.id ?? routeOf(req),
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

  private shouldSample(req: Request, action: string): boolean {
    const now = Date.now();
    const key = `${req.ip ?? "?"}|${action}`;
    const last = this.lastSampled.get(key);
    if (last !== undefined && now - last < SAMPLE_WINDOW_MS) return false;
    if (this.lastSampled.size >= SAMPLE_MAX_KEYS) this.lastSampled.clear();
    this.lastSampled.set(key, now);
    return true;
  }
}

/** The route pattern when Express matched one, else a truncated path: a caller picks the path, so it must be bounded. */
function routeOf(req: Request): string {
  const route = req.route as { path?: unknown } | undefined;
  const path =
    typeof route?.path === "string" ? `${req.baseUrl}${route.path}` : req.path;
  return `${req.method} ${path}`.slice(0, MAX_ENTITY_ID);
}
