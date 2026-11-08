import { Inject, Injectable } from "@nestjs/common";
import {
  MASTER_DATA_READER,
  type MasterDataReader,
} from "./domain/master-data-reader.js";
import { StockPosition } from "./domain/stock-position.js";

/**
 * Available stock by item number, for whoever must judge an order against
 * it. It asks the reader, so P-20's connector answers it with Navision's own
 * figures.
 */
@Injectable()
export class StockLookup {
  constructor(
    @Inject(MASTER_DATA_READER) private readonly reader: MasterDataReader,
  ) {}

  async availableStockOf(
    itemNos: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const wanted = new Set(itemNos);
    const items = await this.reader.items();
    return new Map(
      items
        .filter((item) => wanted.has(item.no))
        // Available stock reads only the item's own figures, so no orders are passed.
        .map((item) => [item.no, new StockPosition(item, []).availableStock]),
    );
  }
}
