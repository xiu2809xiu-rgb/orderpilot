import { Module } from "@nestjs/common";
import { syntheticSourceProvider } from "../../../common/synthetic-source.js";
import { ORDER_DIRECTORY } from "../domain/order-directory.js";
import { SalesOrderRepository } from "../sales-order.repository.js";
import { CompositeOrderDirectory } from "./composite-order-directory.js";
import { SampleOrderSource } from "./sample-order-source.js";
import { StoredOrderSource } from "./stored-order-source.js";

/**
 * The one answer for an order, sample or stored. It imports no feature, so any
 * module may depend on it without a cycle. `DatabaseModule` is global.
 */
@Module({
  providers: [
    syntheticSourceProvider,
    SalesOrderRepository,
    SampleOrderSource,
    StoredOrderSource,
    { provide: ORDER_DIRECTORY, useClass: CompositeOrderDirectory },
  ],
  exports: [ORDER_DIRECTORY, SalesOrderRepository],
})
export class OrderDirectoryModule {}
