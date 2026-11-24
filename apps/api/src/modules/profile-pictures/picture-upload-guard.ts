import { Inject, Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service.js";

/** Longer than one upload can take: a 5 s AI wait, one storage write and one transaction. */
const HOLD_MS = 30_000;

/**
 * One upload in flight per person, held in Redis before the AI call and the
 * storage write (ADR 0069). A transaction lock cannot do this job: it ends
 * with its transaction, and the AI call has to happen outside one. The guard
 * limits cost, not safety: when Redis cannot be reached the upload goes on
 * unguarded and the class of the failure is logged, because the owner lock and
 * the cap under it still hold.
 */
@Injectable()
export class PictureUploadGuard {
  private readonly logger = new Logger(PictureUploadGuard.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /** True when this upload may go on: it is the only one of this person in flight. */
  async enter(userId: string, traceId: string): Promise<boolean> {
    try {
      const reply = await this.redis.client.set(
        keyOf(userId),
        "1",
        "PX",
        HOLD_MS,
        "NX",
      );
      return reply === "OK";
    } catch (error) {
      this.logFailure(error, traceId);
      return true;
    }
  }

  /**
   * Lets the next upload in. Unconditional, so in theory it can free a guard
   * that expired and was taken again by the next upload: the lock absorbs that.
   */
  async leave(userId: string, traceId: string): Promise<void> {
    try {
      await this.redis.client.del(keyOf(userId));
    } catch (error) {
      this.logFailure(error, traceId);
    }
  }

  private logFailure(error: unknown, traceId: string): void {
    this.logger.error(
      {
        traceId,
        errorName: error instanceof Error ? error.name : "NonError",
      },
      "The picture upload guard could not reach Redis; the upload goes on unguarded",
    );
  }
}

function keyOf(userId: string): string {
  return `profile-picture:upload:${userId}`;
}
