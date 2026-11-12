import {
  AS_OF,
  syntheticDataset,
  type Customer,
  type Item,
  type PurchaseOrder,
  type SampleOrder,
  type SyntheticDataset,
  type Vendor,
  type VendorBankAccount,
} from "@orderpilot/synthetic-data";
import { longOrders, longPurchaseOrders } from "./long-orders.js";
import { find } from "./pinned.js";

/** What every kind of document looks things up in, built once for a dataset. */
export interface RenderContext {
  /** As given. */
  dataset: SyntheticDataset;
  /** The same set on the fixed reference date, which dates and dated numbers come from. */
  pinned: SyntheticDataset;
  /** Orders and purchase orders that live beside the dataset, never in it: the long ones. */
  longOrders: readonly SampleOrder[];
  longPurchaseOrders: readonly PurchaseOrder[];
  item: (no: string) => Item;
  customer: (no: string) => Customer;
  vendor: (no: string) => Vendor;
  /** The one MAIN account the data holds for a vendor. */
  bankOf: (vendorNo: string) => VendorBankAccount;
}

const made = new WeakMap<SyntheticDataset, RenderContext>();

function look<T>(map: ReadonlyMap<string, T>, no: string, what: string): T {
  const found = map.get(no);
  if (!found) throw new Error(`No ${what} ${no}`);
  return found;
}

/** Memoised on the dataset object, so a run that renders many documents indexes it once. */
export function contextFor(dataset: SyntheticDataset): RenderContext {
  const cached = made.get(dataset);
  if (cached) return cached;
  const items = new Map(dataset.items.map((i) => [i.no, i]));
  const customers = new Map(dataset.customers.map((c) => [c.no, c]));
  const vendors = new Map(dataset.vendors.map((v) => [v.no, v]));
  const context: RenderContext = {
    dataset,
    pinned: syntheticDataset({ referenceDate: AS_OF }),
    // Built on first use: most documents never touch a long order.
    get longOrders() {
      return longOrders(dataset);
    },
    get longPurchaseOrders() {
      return longPurchaseOrders(dataset);
    },
    item: (no) => look(items, no, "item"),
    customer: (no) => look(customers, no, "customer"),
    vendor: (no) => look(vendors, no, "vendor"),
    bankOf: (vendorNo) =>
      find(
        dataset.vendorBankAccounts,
        (a) => a.vendorNo === vendorNo && a.code === "MAIN",
        `bank account of ${vendorNo}`,
      ),
  };
  made.set(dataset, context);
  return context;
}
