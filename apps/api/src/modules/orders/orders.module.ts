import { Module } from "@nestjs/common";
import { MasterDataModule } from "../master-data/master-data.module.js";
import { WorkflowsModule } from "../workflows/workflows.module.js";
import { OrderDirectoryModule } from "./directory/order-directory.module.js";
import { OrderMasking } from "./domain/order-masking.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

/**
 * Area 1: orders. The reader and the list are here; the write route is P-49.
 */
@Module({
  imports: [OrderDirectoryModule, MasterDataModule, WorkflowsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberAllocator, OrderMasking],
  exports: [OrderDirectoryModule, OrderNumberAllocator],
})
export class OrdersModule {}
