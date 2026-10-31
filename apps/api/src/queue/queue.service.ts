import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Queue, type DefaultJobOptions } from "bullmq";
import { RedisService } from "../redis/redis.service.js";

/** Keeps every OrderPilot key apart from anything else in the same Redis. */
export const QUEUE_PREFIX = "orderpilot";

/** BullMQ forbids a colon in a queue name, and a plain name is easier to read in logs. */
const QUEUE_NAME = /^[a-z][a-z0-9-]{0,62}$/;

/** What every job gets unless its queue says otherwise: retry with back-off, keep a short history. */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

/**
 * Hands out BullMQ queues by name, one instance per name. Nothing here knows
 * an application queue: area modules ask for their own (`documents`,
 * `exports`) and P-15 adds the worker process that consumes them.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  queue<Data = unknown, Result = unknown>(name: string): Queue<Data, Result> {
    if (!QUEUE_NAME.test(name)) {
      throw new RangeError(
        `Queue name "${name}" must be lower-case letters, digits and hyphens, starting with a letter`,
      );
    }
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.redis.client,
        prefix: QUEUE_PREFIX,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      // A Redis outage is reported by the readiness check; do not crash on it.
      queue.on("error", () => undefined);
      this.queues.set(name, queue);
    }
    return queue as Queue<Data, Result>;
  }

  get names(): string[] {
    return [...this.queues.keys()].sort();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}
