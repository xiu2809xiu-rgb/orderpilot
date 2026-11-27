import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../database/database.js";

export interface ChallengeRecord {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly wrongTries: number;
}

export interface NewChallenge {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

const SELECTED = {
  id: true,
  userId: true,
  expiresAt: true,
  wrongTries: true,
} as const;

/**
 * The only place the TwoStepChallenge table is read or written. A challenge is
 * one password sign-in waiting for its second step; only the SHA-256 of its
 * token is stored. The channel column defaults to the authenticator app, the
 * only one that exists.
 */
@Injectable()
export class TwoStepChallengeRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async create(challenge: NewChallenge): Promise<void> {
    await this.database.client.twoStepChallenge.create({ data: challenge });
  }

  /** Without a lock: only to learn whose row to lock first (the order is secret, then challenge). */
  async findByHash(tokenHash: string): Promise<ChallengeRecord | null> {
    return this.database.client.twoStepChallenge.findUnique({
      where: { tokenHash },
      select: SELECTED,
    });
  }

  /** The challenge, locked until the transaction ends. Call it after the person's secret row is locked. */
  async findByHashForUpdate(
    tokenHash: string,
  ): Promise<ChallengeRecord | null> {
    await this.database.client
      .$queryRaw`SELECT id FROM "TwoStepChallenge" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    return this.findByHash(tokenHash);
  }

  /** Counts a wrong try and returns how many this challenge has now. */
  async addWrongTry(id: string): Promise<number> {
    const row = await this.database.client.twoStepChallenge.update({
      where: { id },
      data: { wrongTries: { increment: 1 } },
      select: { wrongTries: true },
    });
    return row.wrongTries;
  }

  async delete(id: string): Promise<void> {
    await this.database.client.twoStepChallenge.deleteMany({ where: { id } });
  }

  /** Only this person's expired rows, so a login never waits on someone else's. */
  async deleteExpiredOf(userId: string, before: Date): Promise<number> {
    const result = await this.database.client.twoStepChallenge.deleteMany({
      where: { userId, expiresAt: { lte: before } },
    });
    return result.count;
  }
}
