import { Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { STRICT_RATE_LIMIT_KEY } from "./auth/decorators.js";
import { AuthGuard } from "./auth/guards/auth.guard.js";
import { CsrfGuard } from "./auth/guards/csrf.guard.js";
import { PermissionsGuard } from "./auth/guards/permissions.guard.js";
import type { AppConfig } from "./config/app-config.js";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { ChecksModule } from "./modules/checks/checks.module.js";
import { InsightsModule } from "./modules/insights/insights.module.js";
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
              name: "default",
              ttl: config.rateLimit.windowSeconds * 1000,
              limit: config.rateLimit.maxRequests,
            },
            {
              // Sign-in routes also count against this stricter limit.
              name: "auth",
              ttl: config.rateLimit.windowSeconds * 1000,
              limit: config.auth.rateLimitMaxRequests,
              skipIf: (context) =>
                !Reflect.getMetadata(
                  STRICT_RATE_LIMIT_KEY,
                  context.getHandler(),
                ),
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
        AuthModule.register(config),
        ChecksModule,
        InsightsModule,
      ],
      // The order is the rule: throttle, then who are you, then is the
      // request really from our page, then may you. Every route is covered;
      // a route says @Public(), @Authenticated() or @RequirePermission().
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useExisting: AuthGuard },
        { provide: APP_GUARD, useExisting: CsrfGuard },
        { provide: APP_GUARD, useExisting: PermissionsGuard },
      ],
    };
  }
}
