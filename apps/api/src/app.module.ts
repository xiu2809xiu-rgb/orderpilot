import { Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { AppConfig } from "./config/app-config.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
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
        SystemModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
