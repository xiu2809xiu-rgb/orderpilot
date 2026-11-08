import { Module } from "@nestjs/common";
import { WorkflowsModule } from "../workflows/workflows.module.js";
import { OrderDirectoryModule } from "./directory/order-directory.module.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";

/**
 * Area 1: orders. The reader and the list come with their routes; the write
 * route is P-49.
 */
@Module({
  imports: [OrderDirectoryModule, WorkflowsModule],
  providers: [OrderNumberAllocator],
  exports: [OrderDirectoryModule, OrderNumberAllocator],
})
export class OrdersModule {}
