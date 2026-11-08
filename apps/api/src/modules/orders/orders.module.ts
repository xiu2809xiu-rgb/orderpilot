import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { MasterDataModule } from "../master-data/master-data.module.js";
import { WorkflowsModule } from "../workflows/workflows.module.js";
import { OrderDirectoryModule } from "./directory/order-directory.module.js";
import { OrderMasking } from "./domain/order-masking.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";
import { OrdersWriteService } from "./orders-write.service.js";

/**
 * Area 1: orders. The reader, the list and the draft writes (ADR 0047).
 */
@Module({
  imports: [
    OrderDirectoryModule,
    MasterDataModule,
    WorkflowsModule,
    AuditModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersWriteService,
    OrderNumberAllocator,
    OrderMasking,
  ],
  exports: [OrderDirectoryModule, OrderNumberAllocator],
})
export class OrdersModule {}
