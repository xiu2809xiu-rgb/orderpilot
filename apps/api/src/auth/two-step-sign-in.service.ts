import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service.js";
import { Clock } from "../common/clock.js";
import { DomainError } from "../common/domain-error.js";
import { requestIdOf } from "../common/request-id.js";
import { Database } from "../database/database.js";
import {
  hashChallengeToken,
  newChallengeToken,
} from "../two-step/domain/challenge-token.js";
import { judgeChallenge } from "../two-step/domain/challenge-judge.js";
import { TWO_STEP_RULES } from "../two-step/domain/two-step-rules.js";
import { TwoStepLockedError } from "../two-step/domain/two-step-locked-error.js";
import {
  challengeEnds,
  lockedRecently,
} from "../two-step/domain/try-limits.js";
import { TwoStepChallengeRepository } from "../two-step/two-step-challenge.repository.js";
import { TwoStepRepository } from "../two-step/two-step.repository.js";
import { UserRepository, type UserRecord } from "../users/user.repository.js";
import { AuthAuditor } from "./auth-auditor.js";
import {
  TwoStepProofService,
  type Proof,
  type WrongReason,
} from "./two-step-proof.service.js";

export interface IssuedChallenge {
  /** The value of the op_two_step cookie. Never stored: only its hash is. */
  readonly token: string;
  readonly ttlSeconds: number;
}

export type SignInCheck =
  | {
      readonly ok: true;
      readonly user: UserRecord;
      readonly method: "code" | "recovery-code";
      readonly recoveryCodesLeft: number;
      /** A lock was placed in the last 7 days, even if this success cleared it. */
      readonly lockedRecently: boolean;
    }
  | { readonly ok: false; readonly error: DomainError };

const SIGN_IN_REFUSAL = "A two-step sign-in step was refused";
const ENDED_MESSAGE =
  "This sign-in has ended. Enter your email and password again.";

/**
 * The second step of a password sign-in. After a right password, `challengeFor`
 * makes a challenge; `check` takes the challenge and the proof and says whether
 * the person may now be given a session. It never starts the session: the
 * caller does, in the same transaction, so a code and its session commit
 * together.
 *
 * A refused step returns an outcome and does not throw, because a throw would
 * roll back the counter and the audit row the refusal depends on. The caller
 * throws after the commit.
 *
 * Every exit that ends the attempt answers with the same words, so the answer
 * does not say which of "no challenge", "expired", "disabled" or "turned off"
 * it was. The reason is in the audit row.
 */
@Injectable()
export class TwoStepSignInService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(TwoStepRepository) private readonly secrets: TwoStepRepository,
    @Inject(TwoStepChallengeRepository)
    private readonly challenges: TwoStepChallengeRepository,
    @Inject(TwoStepProofService) private readonly proof: TwoStepProofService,
    @Inject(AuthAuditor) private readonly auditor: AuthAuditor,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** A challenge when the person has two-step on, else null: a plain session follows. */
  async challengeFor(
    req: Request,
    user: UserRecord,
  ): Promise<IssuedChallenge | null> {
    // A cheap read first, so a person without two-step costs no transaction.
    // It is only a hint: the transaction below decides, under the lock.
    const state = await this.secrets.stateOf(user.id);
    // A pending setup guards nothing.
    if (state?.status !== "ACTIVE") return null;
    const now = this.clock.now();
    const token = newChallengeToken();
    // The order is a rule, and it is the order the verify route uses: the
    // person's row first, then the challenge, then (inside the audit write)
    // the chain.
    // - The row first. Deleting an expired challenge before taking the row
    //   made a login hold that challenge while waiting for the row, and a
    //   verify of it holds the row while waiting for the challenge: a deadlock.
    //   Under the lock the state is also read again, so a turn-off or a reset
    //   between the hint and here ends in a plain session, not a failed insert.
    // - The insert before the audit row. The audit write takes the global chain
    //   lock. Writing the audit row first would hold the chain lock while
    //   waiting for the row, and a verify holds the row while waiting for the
    //   chain lock: a deadlock.
    const issued = await this.database.transaction(async () => {
      const row = await this.secrets.lockForUse(user.id);
      if (row?.status !== "ACTIVE") return false;
      await this.challenges.deleteExpiredOf(user.id, now);
      await this.challenges.create({
        userId: user.id,
        tokenHash: hashChallengeToken(token),
        expiresAt: new Date(
          now.getTime() + TWO_STEP_RULES.challengeSeconds * 1000,
        ),
      });
      await this.audit.record({
        actor: { kind: "user", userId: user.id, role: user.role },
        action: "auth.two-step.challenged",
        entityType: "User",
        entityId: user.id,
        summary: "A two-step sign-in was started",
        changes: { channel: "authenticator" },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
      return true;
    });
    return issued
      ? { token, ttlSeconds: TWO_STEP_RULES.challengeSeconds }
      : null;
  }

  /**
   * Checks a challenge and a proof. Call it inside the transaction that will
   * also start the session. The order of the locks is the person's row first,
   * then the challenge, then (inside the audit write) the chain.
   */
  async check(
    req: Request,
    token: string | undefined,
    proof: Proof,
  ): Promise<SignInCheck> {
    const now = this.clock.now();
    if (token === undefined) return this.ended(req, "no-challenge", null);
    const tokenHash = hashChallengeToken(token);
    const found = await this.challenges.findByHash(tokenHash);
    if (found === null) return this.ended(req, "unknown-challenge", null);

    const row = await this.secrets.lockForUse(found.userId);
    // Read again under the lock: a second tab may have finished it meanwhile.
    const challenge = await this.challenges.findByHashForUpdate(tokenHash);
    if (challenge === null) return this.ended(req, "unknown-challenge", null);
    const user = await this.users.findById(challenge.userId);

    if (user?.disabledAt !== null) {
      await this.challenges.delete(challenge.id);
      return this.ended(req, "user-disabled", user);
    }
    if (row?.status !== "ACTIVE") {
      await this.challenges.delete(challenge.id);
      return this.ended(req, "not-on", user);
    }
    if (judgeChallenge(challenge, now) !== "ok") {
      await this.challenges.delete(challenge.id);
      return this.ended(req, "expired-challenge", user);
    }

    const outcome = await this.proof.check(row, proof, now);
    if (outcome.kind === "locked") {
      await this.refuse(req, "still-locked", user, true);
      return {
        ok: false,
        error: new TwoStepLockedError(outcome.retryAfterSeconds),
      };
    }
    if (outcome.kind === "wrong") {
      return this.refuseWrong(req, user, challenge.id, outcome);
    }

    await this.challenges.delete(challenge.id);
    if (outcome.method === "recovery-code") {
      await this.audit.record({
        actor: { kind: "user", userId: user.id, role: user.role },
        action: "auth.two-step.recovery-code-used",
        entityType: "User",
        entityId: user.id,
        summary: "A recovery code was used to sign in",
        changes: { left: outcome.recoveryCodesLeft },
        ip: req.ip ?? null,
        traceId: requestIdOf(req),
      });
    }
    return {
      ok: true,
      user,
      method: outcome.method,
      recoveryCodesLeft: outcome.recoveryCodesLeft,
      lockedRecently: lockedRecently(row.lastLockedAt, now),
    };
  }

  /** A wrong proof: count it on the challenge, audit it, and end the challenge on the fifth. */
  private async refuseWrong(
    req: Request,
    user: UserRecord,
    challengeId: string,
    outcome: { reason: WrongReason; lockedNow: boolean },
  ): Promise<SignInCheck> {
    const tries = await this.challenges.addWrongTry(challengeId);
    const ends = challengeEnds(tries);
    await this.refuse(req, ends ? "too-many-tries" : outcome.reason, user);
    if (outcome.lockedNow) await this.refuse(req, "locked-now", user);
    if (!ends) {
      return {
        ok: false,
        error: new DomainError(
          "TWO_STEP_CODE_INVALID",
          "That code did not work. Wait for the next code and try again.",
        ),
      };
    }
    // The fifth wrong code ends the attempt and wins over a lock it also
    // placed: the page leaves the code step at once instead of shaking.
    await this.challenges.delete(challengeId);
    return { ok: false, error: endedError() };
  }

  private async ended(
    req: Request,
    reason: string,
    user: UserRecord | null,
  ): Promise<SignInCheck> {
    // Anyone can cause these with no proof at all (a missing or made-up
    // cookie), so they are sampled. A known account's is written every time.
    await this.refuse(req, reason, user, user === null);
    return { ok: false, error: endedError() };
  }

  private refuse(
    req: Request,
    reason: string,
    user: UserRecord | null,
    sampled = false,
  ): Promise<void> {
    return this.auditor.refused(req, {
      action: "auth.two-step.refused",
      reason,
      summary: SIGN_IN_REFUSAL,
      changes: { via: "sign-in" },
      ...(user ? { user, entity: { type: "User", id: user.id } } : {}),
      // Each known account has a key of its own: an anonymous "no-challenge"
      // must not hide the "still-locked" of a person who proved their password,
      // and one locked account must not hide another behind the same address.
      // The anonymous reasons share one key, so junk cannot flood the trail by
      // varying the reason.
      ...(sampled
        ? {
            sampled: true,
            sampleBy: user ? `account:${user.id}` : "anonymous",
          }
        : {}),
    });
  }
}

function endedError(): DomainError {
  return new DomainError("TWO_STEP_CHALLENGE_ENDED", ENDED_MESSAGE);
}
