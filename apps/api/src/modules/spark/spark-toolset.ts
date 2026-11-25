import { Inject, Injectable } from "@nestjs/common";
import type { ReadOnlyTool } from "../ai/domain/read-only-tool.js";
import { MasterDataService } from "../master-data/master-data.service.js";
import { OrdersService } from "../orders/orders.service.js";
import type { SparkRun } from "./spark-run.js";
import { CHECK_STOCK, checkStockTool } from "./tools/check-stock.tool.js";
import { FIND_ORDERS, findOrdersTool } from "./tools/find-orders.tool.js";
import { GET_ORDER, getOrderTool } from "./tools/get-order.tool.js";

/** The names of Spark's tools: the run asks whether a refused call was one of these. */
export const SPARK_TOOL_NAMES: readonly string[] = [
  CHECK_STOCK,
  FIND_ORDERS,
  GET_ORDER,
];

/**
 * Makes Spark's tools for ONE question. They are read-only by construction
 * (`defineReadOnlyTool` has no write path) and each is bound to the run of
 * that question, so what it looked at lands in that answer's sources and
 * nowhere else. They hold two read services and nothing that writes: the
 * import guard of this module keeps it so.
 */
@Injectable()
export class SparkToolset {
  constructor(
    @Inject(MasterDataService) private readonly masterData: MasterDataService,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  forRun(run: SparkRun): readonly ReadOnlyTool[] {
    return [
      checkStockTool(this.masterData, run),
      findOrdersTool(this.orders, run),
      getOrderTool(this.orders, run),
    ];
  }
}
