import { Module } from "@nestjs/common";
import { syntheticSourceProvider } from "../../common/synthetic-source.js";
import { ORDER_STATUS_READER } from "./domain/order-status-reader.js";
import { ExceptionsController } from "./exceptions.controller.js";
import { ExceptionsService } from "./exceptions.service.js";
import { MockChecksRepository } from "./mock-checks.repository.js";
import { MockOrderStatusReader } from "./mock-order-status-reader.js";
import { TrackerController } from "./tracker.controller.js";
import { TrackerService } from "./tracker.service.js";

/**
 * Area 3: checks, the tracker and the exceptions queue. Everything here
 * answers with mock data today. To go live, swap `MockChecksRepository` for a
 * Prisma one and `MockOrderStatusReader` for a class that calls area 2's API;
 * the services and controllers stay as they are.
 */
@Module({
  controllers: [TrackerController, ExceptionsController],
  providers: [
    syntheticSourceProvider,
    MockChecksRepository,
    { provide: ORDER_STATUS_READER, useClass: MockOrderStatusReader },
    TrackerService,
    ExceptionsService,
  ],
})
export class ChecksModule {}
