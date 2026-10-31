import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { AppConfig } from "../config/app-config.js";

/**
 * The one Redis connection of the process. BullMQ shares it for its queues
 * (workers make their own blocking connections, in P-15).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(AppConfig) config: AppConfig) {
    this.client = new Redis(config.redis.url, {
      // BullMQ requires this: a command waits for the server instead of
      // failing after a few retries, and the readiness check has its own limit.
      maxRetriesPerRequest: null,
    });
    // Without a listener an unreachable Redis would crash the process with an
    // unhandled 'error' event. The readiness check reports it instead.
    this.client.on("error", () => undefined);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  onModuleDestroy(): void {
    // Not quit(): it would wait for a server that may be gone.
    this.client.disconnect();
  }
}
