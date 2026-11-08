import { Module } from "@nestjs/common";
import { syntheticSourceProvider } from "../../common/synthetic-source.js";
import { MASTER_DATA_READER } from "./domain/master-data-reader.js";
import { MasterDataController } from "./master-data.controller.js";
import { MasterDataService } from "./master-data.service.js";
import { StockLookup } from "./stock-lookup.js";
import { MockNavisionMasterData } from "./mock-navision-master-data.js";

/**
 * Area 1: items, customers and vendors, read-only. Today they come from the
 * mock of Navision. P-20 binds its connector to `MASTER_DATA_READER` here, and
 * nothing else changes.
 */
@Module({
  controllers: [MasterDataController],
  providers: [
    syntheticSourceProvider,
    { provide: MASTER_DATA_READER, useClass: MockNavisionMasterData },
    MasterDataService,
    StockLookup,
  ],
  exports: [StockLookup],
})
export class MasterDataModule {}
