import { itemQuerySchema } from "@orderpilot/shared";
import { z } from "zod";
import { defineReadOnlyTool } from "../../ai/domain/read-only-tool.js";
import type { MasterDataService } from "../../master-data/master-data.service.js";
import type { SparkRun } from "../spark-run.js";
import { MAX_STOCK_ITEMS, stockOutputOf } from "./spark-tool-results.js";

export const CHECK_STOCK = "check_stock";

const inputSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .describe(
      "An item number such as I-0025, or words from the item's description, brand or part number.",
    ),
});

/**
 * The stock of the items a search finds: on hand, on sales orders, on purchase
 * orders and available, as the item list shows them. It reads the same
 * service as the Items page, as the person asking, so a price the role may not
 * see comes back hidden and stays hidden.
 */
export function checkStockTool(masterData: MasterDataService, run: SparkRun) {
  return defineReadOnlyTool({
    name: CHECK_STOCK,
    description: `Looks up the stock of items in the item list: on hand, on sales orders, on purchase orders and available. Shows up to ${String(MAX_STOCK_ITEMS)} items. A price the person may not see comes back hidden.`,
    // The permission of the Items page it reads. The loop asks for it as the person.
    permission: "orders.read",
    inputSchema,
    async execute(input, context) {
      const page = await masterData.listItems(
        itemQuerySchema.parse({
          page: 1,
          pageSize: MAX_STOCK_ITEMS,
          search: input.search,
        }),
        context.actor.role,
      );
      const output = stockOutputOf(page);
      run.addSources(output.sources);
      return output.result;
    },
  });
}
