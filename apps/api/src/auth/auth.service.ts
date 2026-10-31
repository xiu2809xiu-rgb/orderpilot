import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthOptions, Role, Session } from "@orderpilot/shared";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service.js";
import { DomainError } from "../common/domain-error.js";
import { requestIdOf } from "../common/request-id.js";
import { AppConfig } from "../config/app-config.js";
import { Database } from "../database/database.js";
import { RefreshTokenRepository } from "../sessions/refresh-token.repository.js";
import { UserRepository, type UserRecord } from "../users/user.repository.js";
import type { AuthContext } from "./auth-context.js";
import { AuthAuditor } from "./auth-auditor.js";
import type { IssuedCookies } from "./auth-cookies.js";
import { DEMO_ACCOUNTS, demoEmail } from "./demo-accounts.js";
import { AccessTokens } from "./domain/access-token.js";
import { CsrfTokens } from "./domain/csrf-token.js";
import { PasswordHasher } from "./domain/password-hasher.js";
import { hashRefreshToken, newRefreshToken } from "./domain/refresh-token.js";
import { judgeRefreshToken } from "./domain/refresh-rotation.js";
import { RolePermissionRepository } from "./role-permission.repository.js";

export interface SignedIn {
  readonly session: Session;
  readonly cookies: IssuedCookies;
}

type Outcome =
  | { readonly ok: true; readonly signedIn: SignedIn }
  | { readonly ok: false; readonly error: DomainError };

const INVALID_CREDENTIALS = "The email or password is not right.";

/**
 * Sign-in, refresh, sign-out and the session a signed-in user sees. It owns
 * the rules: what is stored, what is audited, when a family of refresh tokens
 * is revoked. The controller only moves cookies and bodies.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(Database) private readonly database: Database,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(RefreshTokenRepository)
    private readonly tokens: RefreshTokenRepository,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(AccessTokens) private readonly access: AccessTokens,
    @Inject(CsrfTokens) private readonly csrf: CsrfTokens,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
  ) {}

  /** What the sign-in page needs to know. */
  options(): AuthOptions {
    return this.config.demoMode
      ? {
          demoMode: true,
          demoRoles: DEMO_ACCOUNTS.map(({ role, displayName }) => ({
            role,
            displayName,
          })),
        }
      : { demoMode: false, demoRoles: [] };
  }

  async login(
    req: Request,
    credentials: { email: string; password: string },
  ): Promise<SignedIn> {
    const user = await this.users.findByEmail(credentials.email);
    // Always verify, against a dummy hash when there is nothing to check, so
    // an unknown user and a wrong password cost the same.
    const passwordOk = await this.hasher.check(
      user?.passwordHash ?? null,
      credentials.password,
    );
    if (!user || !passwordOk || user.disabledAt !== null) {
      const reason = !user
        ? "unknown-user"
        : user.disabledAt !== null
          ? "user-disabled"
          : "wrong-password";
      await this.refuseLogin(req, "auth.login.refused", reason, user);
      throw new DomainError("INVALID_CREDENTIALS", INVALID_CREDENTIALS);
    }
    return this.startSession(req, user, false);
  }

  async demoLogin(req: Request, role: Role): Promise<SignedIn> {
    const user = await this.users.findByEmail(demoEmail(role));
    if (user?.disabledAt !== null) {
      await this.refuseLogin(
        req,
        "auth.demo-login.refused",
        user ? "user-disabled" : "unknown-user",
        user,
        { role },
      );
      throw new DomainError(
        "INVALID_CREDENTIALS",
        "That demo account is not available.",
      );
    }
    return this.startSession(req, user, true);
  }

  /** The session of the caller the auth guard found. */
  async sessionOf(auth: AuthContext): Promise<Session> {
    return {
      user: {
        id: auth.user.id,
        displayName: auth.user.displayName,
        email: auth.user.email,
        role: auth.user.role,
      },
      permissions: await this.matrix.permissionsOf(auth.user.role),
      expiresAt: auth.expiresAt.toISOString(),
      demo: auth.demo,
    };
  }

  /**
   * Exchanges a refresh token for a new pair. Each token works once. Presenting
   * one that was used already means a copy exists somewhere else, so the whole
   * family of that sign-in is revoked, audited, and the caller is refused.
   */
  async refresh(
    req: Request,
    presented: string | undefined,
  ): Promise<SignedIn> {
    if (!presented) {
      throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
    }
    // The outcome is returned, not thrown, from inside the transaction: a
    // throw would roll back the revocation that the refusal depends on.
    const outcome = await this.database.transaction((): Promise<Outcome> =>
      this.rotate(req, presented),
    );
    if (!outcome.ok) throw outcome.error;
    return outcome.signedIn;
  }

  /** Ends the sign-in the refresh token belongs to. Calling it twice, or with a bad token, is harmless. */
  async logout(req: Request, presented: string | undefined): Promise<void> {
    if (!presented) return;
    await this.database.transaction(async () => {
      const token = await this.tokens.findByHashForUpdate(
        hashRefreshToken(presented),
      );
      if (token?.revokedAt !== null) return;
      const user = await this.users.findById(token.userId);
      const now = new Date();
      await this.tokens.revokeFamily(token.familyId, "logout", now);
      if (!user) return;
      await this.audit.record({
        actor: { kind: "user", userId: user.id, role: user.role },
        action: "auth.logout",
        entityType: "User",
        entityId: user.id,
        summary: `${user.displayName} signed out`,
        changes: { demo: token.demo },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
    });
  }

  private async rotate(req: Request, presented: string): Promise<Outcome> {
    const now = new Date();
    const token = await this.tokens.findByHashForUpdate(
      hashRefreshToken(presented),
    );
    const verdict = judgeRefreshToken(token, now);
    if (token === null || verdict === "unknown") {
      await this.auditor.refused(req, {
        action: "auth.refresh.refused",
        reason: "unknown-token",
        summary: "A refresh token that does not exist was presented",
      });
      return fail("UNAUTHENTICATED", "Sign in to continue.");
    }
    const user = await this.users.findById(token.userId);

    if (verdict === "reused") {
      const revoked = await this.tokens.revokeFamily(
        token.familyId,
        "reuse-detected",
        now,
      );
      await this.audit.record({
        actor: { kind: "system", name: "auth" },
        action: "auth.refresh.reuse-detected",
        entityType: "User",
        entityId: token.userId,
        summary: `A used refresh token was presented again${user ? ` for ${user.displayName}` : ""}; the whole sign-in was revoked`,
        changes: { familyId: token.familyId, tokensRevoked: revoked },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
      return fail(
        "REFRESH_REUSED",
        "This sign-in was ended because its token was used twice. Sign in again.",
      );
    }
    if (verdict !== "ok" || user?.disabledAt !== null) {
      await this.auditor.refused(req, {
        action: "auth.refresh.refused",
        reason: user?.disabledAt ? "user-disabled" : verdict,
        summary: "A refresh was refused",
        entity: { type: "User", id: token.userId },
      });
      return verdict === "expired"
        ? fail("SESSION_EXPIRED", "Your session has ended. Sign in again.")
        : fail("UNAUTHENTICATED", "Sign in to continue.");
    }

    const successor = await this.issue(req, user, token.demo, token.familyId, {
      replaces: { id: token.id, at: now },
    });
    return { ok: true, signedIn: successor };
  }

  private async startSession(
    req: Request,
    user: UserRecord,
    demo: boolean,
  ): Promise<SignedIn> {
    return this.database.transaction(async () => {
      const signedIn = await this.issue(req, user, demo, randomUUID(), null);
      await this.audit.record({
        actor: { kind: "user", userId: user.id, role: user.role },
        action: demo ? "auth.demo-login" : "auth.login",
        entityType: "User",
        entityId: user.id,
        summary: `${user.displayName} signed in${demo ? " (demo)" : ""}`,
        changes: { demo },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
      return signedIn;
    });
  }

  /** Writes the refresh token and signs the access token and CSRF token. */
  private async issue(
    req: Request,
    user: UserRecord,
    demo: boolean,
    familyId: string,
    rotation: { replaces: { id: string; at: Date } } | null,
  ): Promise<SignedIn> {
    const refreshToken = newRefreshToken();
    const newId = await this.tokens.create({
      familyId,
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(
        Date.now() + this.config.auth.refreshTokenTtlSeconds * 1000,
      ),
      demo,
      ip: req.ip ?? null,
      userAgent: req.get("user-agent")?.slice(0, 256) ?? null,
    });
    if (rotation) {
      await this.tokens.markUsed(
        rotation.replaces.id,
        newId,
        rotation.replaces.at,
      );
    }
    const { token: accessToken, expiresAt } = await this.access.sign({
      userId: user.id,
      sessionId: familyId,
      demo,
    });
    return {
      session: {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        },
        permissions: await this.matrix.permissionsOf(user.role),
        expiresAt: expiresAt.toISOString(),
        demo,
      },
      cookies: { accessToken, refreshToken, csrfToken: this.csrf.issue() },
    };
  }

  private async refuseLogin(
    req: Request,
    action: string,
    reason: string,
    user: UserRecord | null,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    // The attempted email is not stored: it may be a mistyped password.
    await this.auditor.refused(req, {
      action,
      reason,
      summary: "A sign-in was refused",
      entity: { type: "User", id: user?.id ?? "unknown" },
      changes: extra,
    });
  }
}

function fail(
  code: ConstructorParameters<typeof DomainError>[0],
  message: string,
): Outcome {
  return { ok: false, error: new DomainError(code, message) };
}
