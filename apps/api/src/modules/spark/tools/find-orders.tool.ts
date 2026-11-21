import { salesOrderQuerySchema } from "@orderpilot/shared";
import { z } from "zod";
import { defineReadOnlyTool } from "../../ai/domain/read-only-tool.js";
import type { OrdersService } from "../../orders/orders.service.js";
import type { SparkRun } from "../spark-run.js";
import { MAX_ORDERS, ordersOutputOf } from "./spark-tool-results.js";

export const FIND_ORDERS = "find_orders";

const inputSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Words from an order number or a customer's name."),
  customerNo: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .optional()
    .describe("A customer number such as C-0001."),
  waitingForStock: z
    .boolean()
    .optional()
    .describe("True to list only orders that are short of stock."),
});

/**
 * The most recent sales orders that match, as the Orders page lists them. It
 * reads the same service as that page, as the person asking, so an amount the
 * role may not see comes back hidden and stays hidden.
 */
export function findOrdersTool(orders: OrdersService, run: SparkRun) {
  return defineReadOnlyTool({
    name: FIND_ORDERS,
    description: `Finds sales orders by words, by customer number, or the ones short of stock. Shows the ${String(MAX_ORDERS)} most recent matches, each with its date, state and amount. An amount the person may not see comes back hidden.`,
    permission: "orders.read",
    inputSchema,
    async execute(input, context) {
      const page = await orders.list(
        salesOrderQuerySchema.parse({
          page: 1,
          pageSize: MAX_ORDERS,
          sort: "orderDate",
          direction: "desc",
          ...(input.search === undefined ? {} : { search: input.search }),
          ...(input.customerNo === undefined
            ? {}
            : { customerNo: input.customerNo }),
          ...(input.waitingForStock === true ? { stock: "waiting" } : {}),
        }),
        context.actor.role,
      );
      const output = ordersOutputOf(page);
      run.addSources(output.sources);
      return output.result;
    },
  });
}
