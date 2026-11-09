import { Inject, Injectable } from "@nestjs/common";
import { ConflictError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";

/** What a key holds: the request it was claimed for, and its answer once there is one. */
export interface KeptCommand {
  readonly requestHash: string;
  readonly response: unknown;
  /** Null while the command runs, or after it stopped without giving its claim back. */
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

export interface CommandClaim {
  readonly actorUserId: string;
  readonly key: string;
  readonly command: string;
  readonly requestHash: string;
}

/** The only code that reads or writes WorkflowCommand. */
@Injectable()
export class WorkflowCommandRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Claims a key before its command runs, and returns the claim's id. Null when
   * the key is taken already, by this request or another one. Committed at once,
   * outside any transaction, so a copy arriving at the same moment sees it.
   * Stamped with the API's clock, the same clock that later judges it abandoned.
   */
  async claim(claim: CommandClaim, at: Date): Promise<string | null> {
    if (this.database.inTransaction) {
      throw new Error(
        "Claim an idempotency key before opening a transaction, so a copy sent at the same moment can see the claim.",
      );
    }
    try {
      const { id } = await this.database.client.workflowCommand.create({
        data: { ...claim, createdAt: at },
        select: { id: true },
      });
      return id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  }

  async find(actorUserId: string, key: string): Promise<KeptCommand | null> {
    return this.database.client.workflowCommand.findUnique({
      where: { actorUserId_key: { actorUserId, key } },
      select: {
        requestHash: true,
        response: true,
        completedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Writes the answer, inside the command's own transaction, so it is there
   * only if the command commits. If the claim is gone, because a later copy
   * took it over, the command must not commit either, so this throws.
   */
  async complete(claimId: string, response: unknown, at: Date): Promise<void> {
    if (!this.database.inTransaction) {
      throw new Error(
        "Keep a command's answer inside the command's transaction, so it is kept only if the command commits.",
      );
    }
    const { count } = await this.database.client.workflowCommand.updateMany({
      where: { id: claimId, completedAt: null },
      // The answer is the route's JSON body, already checked against its schema.
      data: { response: response as Prisma.InputJsonValue, completedAt: at },
    });
    if (count !== 1) {
      throw new ConflictError(
        "This request ran so long that a retry took it over. Reload to see what happened.",
      );
    }
  }

  /**
   * Gives a claim back after its command failed, so a retry can run. By id, so
   * a copy that lost its claim to a later one can never remove that one's.
   */
  async release(claimId: string): Promise<void> {
    await this.database.client.workflowCommand.deleteMany({
      where: { id: claimId, completedAt: null },
    });
  }

  /** Drops a claim whose command stopped long ago without an answer. True if it went. */
  async dropAbandoned(
    actorUserId: string,
    key: string,
    claimedBefore: Date,
  ): Promise<boolean> {
    const { count } = await this.database.client.workflowCommand.deleteMany({
      where: {
        actorUserId,
        key,
        completedAt: null,
        createdAt: { lt: claimedBefore },
      },
    });
    return count === 1;
  }
}
