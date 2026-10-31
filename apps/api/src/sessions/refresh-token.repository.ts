import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../database/database.js";

export interface RefreshTokenRecord {
  readonly id: string;
  readonly familyId: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly demo: boolean;
}

export interface NewRefreshToken {
  readonly familyId: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly demo: boolean;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** The only place the RefreshToken table is read or written. */
@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async create(token: NewRefreshToken): Promise<string> {
    const row = await this.database.client.refreshToken.create({
      data: token,
      select: { id: true },
    });
    return row.id;
  }

  /**
   * Finds a token by its hash and locks the row until the transaction ends, so
   * two refreshes with the same token take turns: the second sees the first's
   * rotation and is treated as a reuse. Call it inside a transaction.
   */
  async findByHashForUpdate(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    await this.database.client
      .$queryRaw`SELECT id FROM "RefreshToken" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
    return this.database.client.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        familyId: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        demo: true,
      },
    });
  }

  /**
   * True while any token of the sign-in is not revoked. Sign-out and reuse
   * revoke them all. The sign-in must also belong to `userId`, so a token
   * naming one user's id and another user's session is not accepted.
   */
  async hasLiveToken(familyId: string, userId: string): Promise<boolean> {
    const live = await this.database.client.refreshToken.findFirst({
      where: { familyId, userId, revokedAt: null },
      select: { id: true },
    });
    return live !== null;
  }

  async markUsed(id: string, successorId: string, at: Date): Promise<void> {
    await this.database.client.refreshToken.update({
      where: { id },
      data: { usedAt: at, replacedByTokenId: successorId },
    });
  }

  /** Revokes every live token of one sign-in. Returns how many it revoked. */
  async revokeFamily(
    familyId: string,
    reason: string,
    at: Date,
  ): Promise<number> {
    const result = await this.database.client.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });
    return result.count;
  }

  /** Revokes every live token of a user, on every device. */
  async revokeAllForUser(
    userId: string,
    reason: string,
    at: Date,
  ): Promise<number> {
    const result = await this.database.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });
    return result.count;
  }
}
