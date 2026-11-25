import { z } from "zod";
import { NotFoundError } from "../../../common/domain-error.js";
import { defineReadOnlyTool } from "../../ai/domain/read-only-tool.js";
import type { OrdersService } from "../../orders/orders.service.js";
import type { SparkRun } from "../spark-run.js";
import {
  MAX_ORDER_LINES,
  notFoundOrder,
  orderOutputOf,
} from "./spark-tool-results.js";

export const GET_ORDER = "get_order";

const inputSchema = z.object({
  orderNo: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .describe("The order number, such as SO-0001 or SO-20261108-0001."),
});

/**
 * One order and its lines, as the order page shows them. An unknown number is
 * an answer, not a failure: the loop would turn a thrown error into "the tool
 * failed", and the model could not tell a typo from an outage.
 */
export function getOrderTool(orders: OrdersService, run: SparkRun) {
  return defineReadOnlyTool({
    name: GET_ORDER,
    description: `Reads one sales order by its number: its customer, dates, state, amount and up to ${String(MAX_ORDER_LINES)} lines with any shortage. An amount the person may not see comes back hidden.`,
    permission: "orders.read",
    inputSchema,
    async execute(input, context) {
      try {
        const output = orderOutputOf(
          await orders.one(input.orderNo, context.actor.role),
        );
        run.addSources(output.sources);
        return output.result;
      } catch (error) {
        if (error instanceof NotFoundError) return notFoundOrder().result;
        throw error;
      }
    },
  });
}
