import { Inject, Injectable } from "@nestjs/common";
import { Database } from "../database/database.js";

/** The only place the RecoveryCode table is read or written. Only hashes are stored. */
@Injectable()
export class RecoveryCodeRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** Throws the person's old codes away, used or not, and stores the new hashes. */
  async replaceAll(userId: string, hashes: readonly string[]): Promise<void> {
    await this.database.client.recoveryCode.deleteMany({ where: { userId } });
    await this.database.client.recoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  /** True when this call is the one that used the code: a second call, or a used code, is false. */
  async consume(userId: string, codeHash: string, at: Date): Promise<boolean> {
    const result = await this.database.client.recoveryCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: at },
    });
    return result.count === 1;
  }

  async countUnused(userId: string): Promise<number> {
    return this.database.client.recoveryCode.count({
      where: { userId, usedAt: null },
    });
  }
}
