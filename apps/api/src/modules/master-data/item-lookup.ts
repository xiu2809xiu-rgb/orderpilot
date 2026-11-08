import { Inject, Injectable } from "@nestjs/common";
import {
  MASTER_DATA_READER,
  type MasterDataReader,
} from "./domain/master-data-reader.js";

/** What an order line starts from: the item's own words and its list price. */
export interface ItemFacts {
  readonly description: string;
  readonly unitPrice: string;
}

/**
 * Items by Navision number, for whoever writes an order line. Like the other
 * lookups it asks the reader, so P-20's connector answers with Navision's own
 * cards. An item that is not there is simply absent from the answer.
 */
@Injectable()
export class ItemLookup {
  constructor(
    @Inject(MASTER_DATA_READER) private readonly reader: MasterDataReader,
  ) {}

  async detailsOf(
    itemNos: readonly string[],
  ): Promise<ReadonlyMap<string, ItemFacts>> {
    const wanted = new Set(itemNos);
    const items = await this.reader.items();
    return new Map(
      items
        .filter((item) => wanted.has(item.no))
        .map((item) => [
          item.no,
          { description: item.description, unitPrice: item.unitPrice },
        ]),
    );
  }
}
