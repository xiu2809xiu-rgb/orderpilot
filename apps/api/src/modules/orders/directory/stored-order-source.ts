import { Inject, Injectable } from "@nestjs/common";
import type { OrderFactsSource } from "../domain/order-directory.js";
import type { OrderFacts } from "../domain/order-facts.js";
import { SalesOrderRepository } from "../sales-order.repository.js";

/**
 * The orders OrderPilot stores itself. It reports no shortage: that needs the
 * stock figures from master data, and the directory must not depend on master
 * data. The orders service works the shortage out from the facts.
 */
@Injectable()
export class StoredOrderSource implements OrderFactsSource {
  constructor(
    @Inject(SalesOrderRepository)
    private readonly orders: SalesOrderRepository,
  ) {}

  async list(): Promise<readonly OrderFacts[]> {
    return (await this.orders.listAll()).map((order) => order.toFacts());
  }

  async find(orderNo: string): Promise<OrderFacts | null> {
    return (await this.orders.findByNo(orderNo))?.toFacts() ?? null;
  }
}
