import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { AppConfig } from "../../config/app-config.js";
import { QUEUE_PREFIX, QueueService } from "../../queue/queue.service.js";
import { RedisService } from "../../redis/redis.service.js";
import { TaskSweepService } from "./task-sweep.service.js";

export const SWEEP_QUEUE = "workflow-sweep";
export const SWEEP_SCHEDULER = "every-so-often";
const STOP_LIMIT_MS = 5_000;

/**
 * Runs the sweep as a repeating BullMQ job, with the queue's retries. It lives
 * in the API until P-15 brings processors into the worker process, which has no
 * module graph yet and will need its own way to start this (ADR 0042). BullMQ
 * gives a run to one consumer only, so more than one API does no harm.
 */
@Injectable()
export class WorkflowSweepJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WorkflowSweepJob.name);
  private worker: Worker | null = null;
  private connection: Redis | null = null;

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(QueueService) private readonly queues: QueueService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(TaskSweepService) private readonly sweeps: TaskSweepService,
    @Inject(HttpAdapterHost) private readonly host: HttpAdapterHost,
  ) {}

  /**
   * Only in the API that serves requests: the seed boots the same module with no
   * HTTP server, and must not start sending. Not awaited, so a Redis outage
   * cannot stop the API starting; the readiness check reports it instead.
   */
  onApplicationBootstrap(): void {
    const seconds = this.config.workflows.sweepSeconds;
    const server: unknown = this.host.httpAdapter;
    if (seconds <= 0 || !server) return;
    this.start(seconds).catch((error: unknown) => {
      this.logger.error({ err: error }, "The workflow sweep did not start");
    });
  }

  async start(seconds: number): Promise<void> {
    // A worker blocks its connection while it waits, so it needs its own.
    this.connection = this.redis.client.duplicate();
    this.connection.on("error", () => undefined);
    this.worker = new Worker(
      SWEEP_QUEUE,
      async () => {
        await this.sweeps.sweep();
      },
      { connection: this.connection, prefix: QUEUE_PREFIX },
    );
    this.worker.on("error", () => undefined);
    this.worker.on("failed", (_job, error) => {
      this.logger.error({ err: error }, "A workflow sweep failed");
    });
    await this.queues
      .queue(SWEEP_QUEUE)
      .upsertJobScheduler(
        SWEEP_SCHEDULER,
        { every: seconds * 1_000 },
        { name: "sweep" },
      );
  }

  /**
   * With Redis down, close() can wait for ever on commands that never fail, and
   * the container would sit there until it is killed. So it gets a time limit.
   */
  async stop(): Promise<void> {
    const limit = new Promise<void>((resolve) => {
      setTimeout(resolve, STOP_LIMIT_MS).unref();
    });
    await Promise.race([this.worker?.close(), limit]);
    this.connection?.disconnect();
    this.worker = null;
    this.connection = null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }
}
