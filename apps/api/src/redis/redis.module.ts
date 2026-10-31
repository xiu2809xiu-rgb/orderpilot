import { Global, Inject, Module, type OnModuleInit } from "@nestjs/common";
import { ReadinessRegistry } from "../health/readiness-registry.js";
import { RedisService } from "./redis.service.js";

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule implements OnModuleInit {
  constructor(
    @Inject(ReadinessRegistry) private readonly readiness: ReadinessRegistry,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.readiness.register({
      name: "redis",
      check: () => this.redis.ping(),
    });
  }
}
