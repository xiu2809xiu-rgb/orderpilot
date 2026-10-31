import {
  makeCustomers,
  makeItems,
  makeVendorBankAccounts,
  makeVendors,
  openingBalances,
} from "./catalogue.js";
import { AS_OF, makeOrders } from "./orders.js";
import { SeededRandom } from "./random.js";
import { SYNTHETIC_LABEL, type SyntheticDataset } from "./types.js";

export const DEFAULT_SEED = 20261102;

export interface DatasetOptions {
  /** Same seed, same data. The default gives the set every screen and test shares. */
  seed?: number;
}

/**
 * Builds the synthetic dataset. Pure and deterministic: no clock, no network,
 * no environment. Call it as often as you like; each call returns fresh
 * objects a test may change.
 */
export function createSyntheticDataset(
  options: DatasetOptions = {},
): SyntheticDataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const random = new SeededRandom(seed);
  const customers = makeCustomers(random);
  const vendors = makeVendors(random);
  const items = makeItems(random, vendors);
  return {
    label: SYNTHETIC_LABEL,
    seed,
    asOf: AS_OF,
    customers,
    vendors,
    vendorBankAccounts: makeVendorBankAccounts(vendors),
    items,
    orders: makeOrders(random, customers, items),
    openingBalances: openingBalances(customers, vendors, items),
  };
}

/** One line for a log: the label and the counts. */
export function describeDataset(dataset: SyntheticDataset): string {
  const count = (list: readonly unknown[]): string => String(list.length);
  return `${dataset.label}: ${count(dataset.customers)} customers, ${count(dataset.vendors)} vendors, ${count(dataset.items)} items, ${count(dataset.orders)} orders (seed ${String(dataset.seed)})`;
}
