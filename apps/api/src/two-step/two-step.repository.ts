import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../database/database.js";
import type { TwoStepSecret as TwoStepRow } from "../generated/prisma/client.js";
import type { TryState } from "./domain/try-limits.js";

export type TwoStepState = "PENDING" | "ACTIVE";

/** One person's two-step row as the services see it. The ciphertext is not in it. */
export interface TwoStepRecord extends TryState {
  readonly id: string;
  readonly userId: string;
  readonly status: TwoStepState;
  readonly lastStep: number | null;
  readonly pendingExpiresAt: Date | null;
  readonly enabledAt: Date | null;
}

/** The row with its ciphertext, only from `lockForUse`, for the one caller that opens it. */
export interface LockedTwoStepRecord extends TwoStepRecord {
  readonly secretCipher: string;
}

/**
 * The only place the TwoStepSecret table is read or written. Deleting the row
 * deletes the person's challenges and recovery codes with it (a foreign key
 * with ON DELETE CASCADE), so a turn-off or a reset cannot leave one behind.
 */
@Injectable()
export class TwoStepRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** The row without its ciphertext, or null when two-step is off. */
  async stateOf(userId: string): Promise<TwoStepRecord | null> {
    const row = await this.database.client.twoStepSecret.findUnique({
      where: { userId },
    });
    return row ? toRecord(row) : null;
  }

  /**
   * Locks the person's row until the transaction ends and returns it with its
   * ciphertext. Everything that reads and then writes the counters, the step
   * or a challenge goes through this first, so two requests take turns: the
   * second sees what the first wrote. Call it inside a transaction.
   */
  async lockForUse(userId: string): Promise<LockedTwoStepRecord | null> {
    await this.database.client
      .$queryRaw`SELECT id FROM "TwoStepSecret" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
    const row = await this.database.client.twoStepSecret.findUnique({
      where: { userId },
    });
    return row ? { ...toRecord(row), secretCipher: row.secretCipher } : null;
  }

  /**
   * Makes or replaces the pending secret. A restart keeps the failure list,
   * the lock and the last lock time, or "start again" would reset the count and
   * defeat the limit.
   */
  async startSetup(
    userId: string,
    secretCipher: string,
    pendingExpiresAt: Date,
  ): Promise<{ replacedPending: boolean }> {
    const before = await this.database.client.twoStepSecret.findUnique({
      where: { userId },
      select: { status: true },
    });
    await this.database.client.twoStepSecret.upsert({
      where: { userId },
      create: {
        userId,
        status: "PENDING",
        secretCipher,
        pendingExpiresAt,
      },
      update: {
        status: "PENDING",
        secretCipher,
        pendingExpiresAt,
        lastStep: null,
        enabledAt: null,
      },
    });
    return { replacedPending: before?.status === "PENDING" };
  }

  /** The first right code switches it on. */
  async activate(userId: string, step: number | null, at: Date): Promise<void> {
    await this.database.client.twoStepSecret.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        pendingExpiresAt: null,
        enabledAt: at,
        lastStep: step,
      },
    });
  }

  async saveCounters(userId: string, state: TryState): Promise<void> {
    await this.database.client.twoStepSecret.update({
      where: { userId },
      data: {
        failedAt: [...state.failedAt],
        lockedUntil: state.lockedUntil,
        locksInARow: state.locksInARow,
        lastLockedAt: state.lastLockedAt,
      },
    });
  }

  /** The step a code was just accepted for: it, and any earlier one, is refused from now on. */
  async acceptStep(userId: string, step: number): Promise<void> {
    await this.database.client.twoStepSecret.update({
      where: { userId },
      data: { lastStep: step },
    });
  }

  /** True when there was a row to delete. */
  async deleteForUser(userId: string): Promise<boolean> {
    const result = await this.database.client.twoStepSecret.deleteMany({
      where: { userId },
    });
    return result.count > 0;
  }
}

function toRecord(row: TwoStepRow): TwoStepRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    lastStep: row.lastStep,
    pendingExpiresAt: row.pendingExpiresAt,
    enabledAt: row.enabledAt,
    failedAt: row.failedAt,
    lockedUntil: row.lockedUntil,
    locksInARow: row.locksInARow,
    lastLockedAt: row.lastLockedAt,
  };
}
