import { Inject, Injectable } from "@nestjs/common";
import {
  MASTER_DATA_READER,
  type MasterDataReader,
} from "./domain/master-data-reader.js";

/**
 * Customer names by Business Central number, for whoever shows a name beside a
 * number. Matching never goes through here: it stays on the number. It asks
 * the reader, so P-20's connector answers it with Business Central's own names.
 */
@Injectable()
export class CustomerLookup {
  constructor(
    @Inject(MASTER_DATA_READER) private readonly reader: MasterDataReader,
  ) {}

  async namesOf(
    customerNos: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const wanted = new Set(customerNos);
    const customers = await this.reader.customers();
    return new Map(
      customers.filter((c) => wanted.has(c.no)).map((c) => [c.no, c.name]),
    );
  }
}
