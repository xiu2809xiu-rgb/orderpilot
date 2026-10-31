import { Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module.js";
import type { AppConfig } from "./config/app-config.js";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { SystemModule } from "./system/system.module.js";

@Module({})
export class AppModule {
  /** The configuration is built first (main.ts) and handed in, so nothing here reads process.env. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        ThrottlerModule.forRoot({
          throttlers: [
            {
              ttl: config.rateLimit.windowSeconds * 1000,
              limit: config.rateLimit.maxRequests,
            },
          ],
        }),
        HealthModule,
        DatabaseModule,
        RedisModule,
        QueueModule,
        StorageModule,
        AuditModule,
        SystemModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
