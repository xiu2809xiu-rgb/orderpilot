import type { INestApplicationContext } from "@nestjs/common";
import {
  MASTER_DATA_READER,
  type MasterDataReader,
} from "../master-data/domain/master-data-reader.js";
import { BankDetailHoldService } from "./bank-detail-hold.service.js";
import { BankFingerprinter } from "./domain/bank-details.js";

const BY_THE_SEED = {
  actor: { kind: "system", name: "seed" },
  ip: null,
  traceId: "seed",
} as const;

/**
 * Stores each vendor's bank accounts as area 1's reader gives them, so a vendor
 * PI has a record to be compared with. Reads through the port, not a module
 * import, because area 1 will import this module to report details.
 *
 * Safe to run again: an account already stored is left alone.
 */
export async function seedVendorBankBaselines(
  app: INestApplicationContext,
): Promise<string> {
  if (!app.get(BankFingerprinter, { strict: false }).configured) {
    return "skipped: BANK_FINGERPRINT_KEY is not set";
  }
  const reader = app.get<MasterDataReader>(MASTER_DATA_READER, {
    strict: false,
  });
  const control = app.get(BankDetailHoldService, { strict: false });
  let total = 0;
  let recorded = 0;
  for (const vendor of await reader.vendors()) {
    for (const account of await reader.vendorBankAccounts(vendor.no)) {
      total += 1;
      const added = await control.recordBaseline(
        {
          vendorNo: vendor.no,
          accountCode: account.code,
          details: account,
        },
        BY_THE_SEED,
      );
      if (added) recorded += 1;
    }
  }
  return `${String(recorded)} vendor bank accounts stored, ${String(total - recorded)} already there`;
}
