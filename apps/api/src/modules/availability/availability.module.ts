import { Module } from "@nestjs/common";
import { Clock, SystemClock } from "../../common/clock.js";
import { AvailabilityController } from "./availability.controller.js";
import { AvailabilityRepository } from "./availability.repository.js";
import { AvailabilityService } from "./availability.service.js";

/**
 * Area 1, the platform: a person's availability (ADR 0070). It imports nothing
 * else, and in particular not the audit module (a change is not audited, by
 * decision) and not the users module. It provides the Clock itself because the
 * auth module keeps its own; a test that overrides the token swaps every one.
 */
@Module({
  controllers: [AvailabilityController],
  providers: [
    AvailabilityService,
    AvailabilityRepository,
    { provide: Clock, useClass: SystemClock },
  ],
})
export class AvailabilityModule {}
