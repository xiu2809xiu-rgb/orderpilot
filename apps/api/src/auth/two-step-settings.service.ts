import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { TwoStepStatus } from "@orderpilot/shared";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service.js";
import { Clock } from "../common/clock.js";
import {
  ConflictError,
  DomainError,
  ValidationFailedError,
} from "../common/domain-error.js";
import { requestIdOf } from "../common/request-id.js";
import { AppConfig } from "../config/app-config.js";
import { Database } from "../database/database.js";
import { RefreshTokenRepository } from "../sessions/refresh-token.repository.js";
import { encodeBase32 } from "../two-step/domain/base32.js";
import { otpauthUri } from "../two-step/domain/otpauth.js";
import {
  formatRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "../two-step/domain/recovery-codes.js";
import { SecretBox } from "../two-step/domain/secret-box.js";
import { TwoStepLockedError } from "../two-step/domain/two-step-locked-error.js";
import {
  TWO_STEP_RULES,
  setupLapsed,
} from "../two-step/domain/two-step-rules.js";
import { lockedRecently } from "../two-step/domain/try-limits.js";
import { RecoveryCodeRepository } from "../two-step/recovery-code.repository.js";
import {
  TwoStepRepository,
  type LockedTwoStepRecord,
} from "../two-step/two-step.repository.js";
import { UserRepository, type UserRecord } from "../users/user.repository.js";
import type { AuthContext } from "./auth-context.js";
import { AuthAuditor } from "./auth-auditor.js";
import { PasswordHasher } from "./domain/password-hasher.js";
import { RolePermissionRepository } from "./role-permission.repository.js";
import { TwoStepProofService, type Proof } from "./two-step-proof.service.js";

/** Where a refusal came from, for `changes.via` of its audit row. */
type Via = "setup" | "enable" | "disable" | "new-codes";

export interface SetupResult {
  readonly setupKey: string;
  readonly otpauthUri: string;
  readonly expiresAt: string;
}

export interface RecoveryCodesResult {
  readonly recoveryCodes: string[];
  readonly status: TwoStepStatus;
}

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };

const CHANGE_REFUSAL = "A two-step change was refused";

/**
 * Turning two-step on and off and making new recovery codes, for the signed-in
 * person. Every change that needs proof asks for it here, so a stolen session
 * cookie alone can neither switch two-step off nor make new codes: it needs
 * the password (of a password session) and a current code or recovery code.
 *
 * A refused change returns an outcome and is thrown after the transaction
 * commits, so the counter and the audit row of a wrong code survive. Wrong
 * proofs answer 422, never 401 or 403: a 401 would make the web client refresh
 * the session and send the same body again, and a 403 is not a wrong code.
 */
@Injectable()
export class TwoStepSettingsService {
  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(Database) private readonly database: Database,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(TwoStepRepository) private readonly secrets: TwoStepRepository,
    @Inject(RecoveryCodeRepository)
    private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(RefreshTokenRepository)
    private readonly tokens: RefreshTokenRepository,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
    @Inject(PasswordHasher) private readonly hasher: PasswordHasher,
    @Inject(SecretBox) private readonly box: SecretBox,
    @Inject(TwoStepProofService) private readonly proof: TwoStepProofService,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** What the card shows. A pending, unconfirmed setup counts as off. */
  async status(auth: AuthContext): Promise<TwoStepStatus> {
    const user = await this.userOf(auth);
    const state = await this.secrets.stateOf(user.id);
    const now = this.clock.now();
    const on = state?.status === "ACTIVE";
    return {
      state: on ? "on" : "off",
      hasPassword: user.passwordHash !== null,
      demoSignInSkips: this.config.demoMode,
      demoAdminBlocked: auth.demo && (await this.managesUsers(auth)),
      enabledAt: on ? (state.enabledAt?.toISOString() ?? null) : null,
      recoveryCodesLeft: on
        ? await this.recoveryCodes.countUnused(user.id)
        : null,
      lastLockedAt:
        state && lockedRecently(state.lastLockedAt, now)
          ? (state.lastLockedAt?.toISOString() ?? null)
          : null,
    };
  }

  /** Makes a secret and shows it once. Nothing guards the account until the first right code (enable). */
  async setup(
    req: Request,
    auth: AuthContext,
    input: { password?: string | undefined },
  ): Promise<SetupResult> {
    const user = await this.userOf(auth);
    // A demo session may start setup for most accounts, but not for one whose
    // role can reset other people's two-step: nobody else could undo it.
    if (auth.demo && (await this.managesUsers(auth))) {
      await this.refuse(req, user, "demo-administrator", "setup");
      throw new ConflictError(
        "A demo session cannot turn on two-step verification for an account that manages other accounts.",
      );
    }
    if (user.passwordHash === null) {
      await this.refuse(req, user, "no-password", "setup");
      throw new ConflictError(
        "This account has no password, so there is no email and password sign-in for two-step to protect.",
      );
    }
    await this.requirePassword(req, auth, user, input.password, "setup");

    const outcome = await this.database.transaction(
      async (): Promise<Outcome<SetupResult>> => {
        const row = await this.secrets.lockForUse(user.id);
        if (row?.status === "ACTIVE") {
          await this.refuse(req, user, "already-on", "setup");
          return failure(
            new ConflictError("Two-step verification is already on."),
          );
        }
        const now = this.clock.now();
        const secret = randomBytes(20);
        const expiresAt = new Date(
          now.getTime() + TWO_STEP_RULES.setupSeconds * 1000,
        );
        const { replacedPending } = await this.secrets.startSetup(
          user.id,
          this.box.seal(secret, user.id),
          expiresAt,
        );
        await this.record(req, user, "auth.two-step.setup-started", {
          summary: "Two-step setup was started",
          changes: { replacedPending },
        });
        const setupKey = encodeBase32(secret);
        return {
          ok: true,
          value: {
            setupKey,
            otpauthUri: otpauthUri(user.email, setupKey),
            expiresAt: expiresAt.toISOString(),
          },
        };
      },
    );
    return unwrap(outcome);
  }

  /** The first right code switches two-step on and shows ten recovery codes, once. */
  async enable(
    req: Request,
    auth: AuthContext,
    input: { code: string },
  ): Promise<RecoveryCodesResult> {
    const user = await this.userOf(auth);
    const outcome = await this.database.transaction(
      async (): Promise<Outcome<RecoveryCodesResult>> => {
        const row = await this.secrets.lockForUse(user.id);
        const now = this.clock.now();
        if (row?.status === "ACTIVE") {
          await this.refuse(req, user, "already-on", "enable");
          return failure(
            new ConflictError("Two-step verification is already on."),
          );
        }
        if (row === null || setupLapsed(row.pendingExpiresAt, now)) {
          await this.refuse(req, user, "setup-ended", "enable");
          return failure(
            new DomainError(
              "TWO_STEP_SETUP_ENDED",
              "The setup ended. Start again to get a new key.",
            ),
          );
        }
        const checked = await this.checkProof(
          req,
          user,
          row,
          {
            kind: "code",
            value: input.code,
          },
          "enable",
        );
        if (!checked.ok) return checked;
        await this.secrets.activate(user.id, checked.value.step, now);
        // Turning it on says "a password is no longer enough", so the other
        // password sign-ins end. This one stays, and so do demo ones (they skip
        // the second step by decision and a shared account has many visitors).
        const ended = await this.tokens.revokeOthersOfUser(
          user.id,
          auth.sessionId,
          "two-step-enabled",
          now,
        );
        const codes = await this.replaceRecoveryCodes(user.id);
        await this.record(req, user, "auth.two-step.enabled", {
          summary: "Two-step verification was turned on",
          changes: {
            recoveryCodes: TWO_STEP_RULES.recoveryCodeCount,
            otherSessionsEnded: ended,
          },
        });
        return {
          ok: true,
          value: { recoveryCodes: codes, status: await this.status(auth) },
        };
      },
    );
    return unwrap(outcome);
  }

  /** Turns two-step off. Needs the password (password session) and a code or recovery code. */
  async disable(
    req: Request,
    auth: AuthContext,
    input: { password?: string | undefined; proof: Proof },
  ): Promise<TwoStepStatus> {
    const user = await this.userOf(auth);
    await this.requirePassword(req, auth, user, input.password, "disable");
    const outcome = await this.database.transaction(
      async (): Promise<Outcome<TwoStepStatus>> => {
        const row = await this.secrets.lockForUse(user.id);
        if (row?.status !== "ACTIVE") {
          await this.refuse(req, user, "not-on", "disable");
          return failure(new ConflictError("Two-step verification is not on."));
        }
        const checked = await this.checkProof(
          req,
          user,
          row,
          input.proof,
          "disable",
        );
        if (!checked.ok) return checked;
        // The row's challenges and recovery codes go with it.
        await this.secrets.deleteForUser(user.id);
        await this.record(req, user, "auth.two-step.disabled", {
          summary: "Two-step verification was turned off",
          changes: { method: checked.value.method },
        });
        return { ok: true, value: await this.status(auth) };
      },
    );
    return unwrap(outcome);
  }

  /** Replaces the recovery codes. Needs a current code: a recovery code is not enough. */
  async newCodes(
    req: Request,
    auth: AuthContext,
    input: { code: string },
  ): Promise<RecoveryCodesResult> {
    const user = await this.userOf(auth);
    const outcome = await this.database.transaction(
      async (): Promise<Outcome<RecoveryCodesResult>> => {
        const row = await this.secrets.lockForUse(user.id);
        if (row?.status !== "ACTIVE") {
          await this.refuse(req, user, "not-on", "new-codes");
          return failure(new ConflictError("Two-step verification is not on."));
        }
        const checked = await this.checkProof(
          req,
          user,
          row,
          {
            kind: "code",
            value: input.code,
          },
          "new-codes",
        );
        if (!checked.ok) return checked;
        const codes = await this.replaceRecoveryCodes(user.id);
        await this.record(req, user, "auth.two-step.recovery-codes-replaced", {
          summary: "Recovery codes were replaced",
          changes: { recoveryCodes: TWO_STEP_RULES.recoveryCodeCount },
        });
        return {
          ok: true,
          value: { recoveryCodes: codes, status: await this.status(auth) },
        };
      },
    );
    return unwrap(outcome);
  }

  /**
   * The password step of a password session, checked before anything is
   * locked. A wrong one touches no counter: it is audited on its own and costs
   * no code attempt, so a wrong password never locks the six-digit entry. A
   * demo session has no password and is asked for none.
   */
  private async requirePassword(
    req: Request,
    auth: AuthContext,
    user: UserRecord,
    password: string | undefined,
    via: Via,
  ): Promise<void> {
    if (auth.demo) return;
    if (password === undefined) {
      throw new ValidationFailedError([
        { path: "password", message: "Enter your password." },
      ]);
    }
    if (!(await this.hasher.check(user.passwordHash, password))) {
      await this.refuse(req, user, "wrong-password", via);
      throw new DomainError("PASSWORD_INCORRECT", "The password is not right.");
    }
  }

  /** Checks a proof against the locked row and turns a wrong or locked one into an outcome. */
  private async checkProof(
    req: Request,
    user: UserRecord,
    row: LockedTwoStepRecord,
    proof: Proof,
    via: Via,
  ): Promise<
    Outcome<{ method: "code" | "recovery-code"; step: number | null }>
  > {
    const outcome = await this.proof.check(row, proof, this.clock.now());
    if (outcome.kind === "ok") {
      return {
        ok: true,
        value: { method: outcome.method, step: outcome.step },
      };
    }
    if (outcome.kind === "locked") {
      await this.refuse(req, user, "still-locked", via);
      return failure(new TwoStepLockedError(outcome.retryAfterSeconds));
    }
    await this.refuse(req, user, outcome.reason, via);
    if (outcome.lockedNow) await this.refuse(req, user, "locked-now", via);
    return failure(
      new DomainError(
        "TWO_STEP_CODE_INVALID",
        "That code did not work. Wait for the next code and try again.",
      ),
    );
  }

  private async replaceRecoveryCodes(userId: string): Promise<string[]> {
    const raw = generateRecoveryCodes(TWO_STEP_RULES.recoveryCodeCount);
    await this.recoveryCodes.replaceAll(userId, raw.map(hashRecoveryCode));
    return raw.map(formatRecoveryCode);
  }

  private async userOf(auth: AuthContext): Promise<UserRecord> {
    const user = await this.users.findById(auth.user.id);
    if (user === null) {
      throw new DomainError("UNAUTHENTICATED", "Sign in to continue.");
    }
    return user;
  }

  private managesUsers(auth: AuthContext): Promise<boolean> {
    return this.matrix.has(auth.user.role, "users.manage");
  }

  private refuse(
    req: Request,
    user: UserRecord,
    reason: string,
    via: Via,
  ): Promise<void> {
    return this.auditor.refused(req, {
      action: "auth.two-step.refused",
      reason,
      summary: CHANGE_REFUSAL,
      user,
      entity: { type: "User", id: user.id },
      changes: { via },
    });
  }

  private async record(
    req: Request,
    user: UserRecord,
    action: string,
    detail: { summary: string; changes: Record<string, unknown> },
  ): Promise<void> {
    await this.audit.record({
      actor: { kind: "user", userId: user.id, role: user.role },
      action,
      entityType: "User",
      entityId: user.id,
      summary: detail.summary,
      changes: detail.changes,
      ip: req.ip ?? null,
      traceId: requestIdOf(req),
    });
  }
}

function failure<T>(error: DomainError): Outcome<T> {
  return { ok: false, error };
}

function unwrap<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
