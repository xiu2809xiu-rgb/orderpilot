import { Global, Module } from "@nestjs/common";
import { BuildInfoRepository } from "./build-info.repository.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { ReadinessRegistry } from "./readiness-registry.js";

/** Global so that the database, Redis and storage modules can register their checks. */
@Global()
@Module({
  controllers: [HealthController],
  providers: [HealthService, BuildInfoRepository, ReadinessRegistry],
  exports: [ReadinessRegistry],
})
export class HealthModule {}
