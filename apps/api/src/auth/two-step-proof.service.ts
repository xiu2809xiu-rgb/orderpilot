import { Inject, Injectable } from "@nestjs/common";
import {
  hashRecoveryCode,
  normaliseRecoveryCode,
} from "../two-step/domain/recovery-codes.js";
import { SecretBox } from "../two-step/domain/secret-box.js";
import { Totp } from "../two-step/domain/totp.js";
import {
  afterFailure,
  afterSuccess,
  isLocked,
  lockRemainingSeconds,
} from "../two-step/domain/try-limits.js";
import { RecoveryCodeRepository } from "../two-step/recovery-code.repository.js";
import {
  TwoStepRepository,
  type LockedTwoStepRecord,
} from "../two-step/two-step.repository.js";

/** What a person presented: six digits from the app, or one recovery code. */
export type Proof =
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "recovery"; readonly value: string };

export type WrongReason =
  "wrong-code" | "replayed-code" | "wrong-recovery-code" | "secret-unreadable";

export type ProofOutcome =
  | {
      readonly kind: "ok";
      readonly method: "code" | "recovery-code";
      /** How many recovery codes are unused after this proof. */
      readonly recoveryCodesLeft: number;
    }
  | {
      readonly kind: "wrong";
      readonly reason: WrongReason;
      /** True when this wrong code was the one that placed a lock. */
      readonly lockedNow: boolean;
    }
  | { readonly kind: "locked"; readonly retryAfterSeconds: number };

/**
 * The one place that checks a presented code or recovery code, for the sign-in
 * step and for every settings route alike, so the limits count across all of
 * them. The caller has already locked the person's row (`lockForUse`) and
 * passes it in. It writes the counters and the step; it writes no audit and
 * knows no HTTP, so the caller decides what to record and what to answer.
 *
 * A recovery code is accepted while six-digit entry is locked: it has 75 bits,
 * so a flood of tries gains nothing, and it is the owner's way round a lock an
 * attacker placed. For the same reason a wrong recovery code does not count
 * toward the lock (it adds nothing to guard), though the caller still counts
 * it against the sign-in challenge.
 */
@Injectable()
export class TwoStepProofService {
  constructor(
    @Inject(TwoStepRepository) private readonly secrets: TwoStepRepository,
    @Inject(RecoveryCodeRepository)
    private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(Totp) private readonly totp: Totp,
    @Inject(SecretBox) private readonly box: SecretBox,
  ) {}

  async check(
    row: LockedTwoStepRecord,
    proof: Proof,
    now: Date,
  ): Promise<ProofOutcome> {
    return proof.kind === "recovery"
      ? this.checkRecovery(row, proof.value, now)
      : this.checkCode(row, proof.value, now);
  }

  private async checkCode(
    row: LockedTwoStepRecord,
    code: string,
    now: Date,
  ): Promise<ProofOutcome> {
    if (isLocked(row, now)) {
      return {
        kind: "locked",
        retryAfterSeconds: lockRemainingSeconds(row, now),
      };
    }
    const secret = this.box.open(row.secretCipher, row.userId);
    // A secret that cannot be opened (JWT_SECRET changed) refuses every code
    // and counts like a wrong one, so the lock still holds.
    const verdict =
      secret === null
        ? ({ kind: "unreadable" } as const)
        : this.totp.judge(secret, code, now, row.lastStep);
    if (verdict.kind === "accepted") {
      await this.secrets.acceptStep(row.userId, verdict.step);
      await this.secrets.saveCounters(row.userId, afterSuccess(row));
      return {
        kind: "ok",
        method: "code",
        recoveryCodesLeft: await this.recoveryCodes.countUnused(row.userId),
      };
    }
    const failed = afterFailure(row, now);
    await this.secrets.saveCounters(row.userId, failed.state);
    return {
      kind: "wrong",
      reason:
        verdict.kind === "replayed"
          ? "replayed-code"
          : verdict.kind === "unreadable"
            ? "secret-unreadable"
            : "wrong-code",
      lockedNow: failed.lockedNow,
    };
  }

  private async checkRecovery(
    row: LockedTwoStepRecord,
    presented: string,
    now: Date,
  ): Promise<ProofOutcome> {
    const normalised = normaliseRecoveryCode(presented);
    const taken =
      normalised !== null &&
      (await this.recoveryCodes.consume(
        row.userId,
        hashRecoveryCode(normalised),
        now,
      ));
    if (!taken) {
      return { kind: "wrong", reason: "wrong-recovery-code", lockedNow: false };
    }
    // A recovery code that works also lifts a lock: it proves the owner.
    await this.secrets.saveCounters(row.userId, afterSuccess(row));
    return {
      kind: "ok",
      method: "recovery-code",
      recoveryCodesLeft: await this.recoveryCodes.countUnused(row.userId),
    };
  }
}
