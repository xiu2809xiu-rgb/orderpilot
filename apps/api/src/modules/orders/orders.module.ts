import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { UsersModule } from "../../users/users.module.js";
import { MasterDataModule } from "../master-data/master-data.module.js";
import { WorkflowsModule } from "../workflows/workflows.module.js";
import { OrderDirectoryModule } from "./directory/order-directory.module.js";
import { OrderHandoff } from "./domain/order-handoff.js";
import { OrderMasking } from "./domain/order-masking.js";
import { LoggingOrderHandoff } from "./mock/logging-order-handoff.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { OrdersWriteService } from "./orders-write.service.js";
import { PoRevisionService } from "./po-revision.service.js";
import { PoVersionRepository } from "./po-version.repository.js";
import { PoVersionsController } from "./po-versions.controller.js";
import { PoVersionsService } from "./po-versions.service.js";

/**
 * Area 1: orders. The reader, the list, the draft writes (ADR 0047) and the
 * PO versions of a submitted order (ADR 0074).
 */
@Module({
  imports: [
    OrderDirectoryModule,
    MasterDataModule,
    WorkflowsModule,
    AuditModule,
    UsersModule,
  ],
  controllers: [OrdersController, PoVersionsController],
  providers: [
    OrdersService,
    OrdersWriteService,
    PoRevisionService,
    PoVersionsService,
    PoVersionRepository,
    OrderNumberAllocator,
    OrderMasking,
    // Area 2 binds its class under this token with one line (ADR 0072).
    { provide: OrderHandoff, useClass: LoggingOrderHandoff },
  ],
  exports: [OrderDirectoryModule, OrderNumberAllocator],
})
export class OrdersModule {}
