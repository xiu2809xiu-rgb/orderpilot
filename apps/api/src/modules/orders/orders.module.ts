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
  // OrdersService only reads. OrdersWriteService stays inside this module, so a
  // module that imports OrdersModule (Spark does, for its read-only tools)
  // cannot inject anything that writes an order.
  exports: [OrderDirectoryModule, OrderNumberAllocator, OrdersService],
})
export class OrdersModule {}
