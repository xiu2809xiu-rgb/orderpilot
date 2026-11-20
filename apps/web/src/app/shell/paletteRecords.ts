import type { Permission } from "@orderpilot/shared";
import { orderHref } from "@/features/directions/screens/home/homeLinks";
import type { MasterDataCustomers200DataItem } from "@/lib/api/generated/model/masterDataCustomers200DataItem";
import type { MasterDataItems200DataItem } from "@/lib/api/generated/model/masterDataItems200DataItem";
import type { MasterDataVendors200DataItem } from "@/lib/api/generated/model/masterDataVendors200DataItem";
import type { OrdersList200DataItem } from "@/lib/api/generated/model/ordersList200DataItem";

/** The kinds the palette searches, in the order its groups appear. */
export const SEARCH_KINDS = ["order", "customer", "vendor", "item"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

// Two characters is the least that narrows anything down.
export const MIN_QUERY_LENGTH = 2;
export const SHOWN_PER_GROUP = 5;
// Asked for more than shown, so that an exact number can rise to the top.
export const FETCHED_PER_GROUP = 10;

/** Every list is served to a role that holds this permission, and refused to the rest. */
export const READ_PERMISSION: Readonly<Record<SearchKind, Permission>> = {
  order: "orders.read",
  customer: "orders.read",
  vendor: "orders.read",
  item: "orders.read",
};

/** A record found by the search. Never an amount: prices are masked for some roles. */
export interface RecordHit {
  id: string;
  kind: SearchKind;
  no: string;
  name: string;
  /** The customer's PO number, for an order. */
  po?: string;
  /** Spectra's word for where the order stands. */
  stage?: string;
  to: string;
  /** The texts the search was matched on, used to put the best match first. */
  keys: readonly string[];
}

/** The pages that open each kind of record, the ones the lists link to. */
export const recordHref: Readonly<Record<SearchKind, (no: string) => string>> =
  {
    order: orderHref,
    customer: (no) => `/master-data/customers/${encodeURIComponent(no)}`,
    vendor: (no) => `/master-data/vendors/${encodeURIComponent(no)}`,
    item: (no) => `/master-data/items/${encodeURIComponent(no)}`,
  };

export const fromOrders = (rows: readonly OrdersList200DataItem[]) =>
  rows.map((row): RecordHit => ({
    id: `order:${row.orderNo}`,
    kind: "order",
    no: row.orderNo,
    name: row.customerName ?? row.customerNo,
    po: row.externalDocumentNo,
    ...(row.workflowStatus ? { stage: row.workflowStatus } : {}),
    to: recordHref.order(row.orderNo),
    keys: [row.orderNo, row.externalDocumentNo, row.customerNo],
  }));

export const fromCustomers = (
  rows: readonly MasterDataCustomers200DataItem[],
) =>
  rows.map((row): RecordHit => ({
    id: `customer:${row.no}`,
    kind: "customer",
    no: row.no,
    name: row.name,
    to: recordHref.customer(row.no),
    keys: [row.no, row.name],
  }));

export const fromVendors = (rows: readonly MasterDataVendors200DataItem[]) =>
  rows.map((row): RecordHit => ({
    id: `vendor:${row.no}`,
    kind: "vendor",
    no: row.no,
    name: row.name,
    to: recordHref.vendor(row.no),
    keys: [row.no, row.name],
  }));

export const fromItems = (rows: readonly MasterDataItems200DataItem[]) =>
  rows.map((row): RecordHit => ({
    id: `item:${row.no}`,
    kind: "item",
    no: row.no,
    name: row.description,
    to: recordHref.item(row.no),
    keys: [row.no, row.description, row.partNumber, row.brand],
  }));

/** 0 for an exact number, then a start, then a word's start, then anything else. */
function rank(hit: RecordHit, term: string): number {
  const keys = hit.keys.map((key) => key.toLowerCase());
  if (keys.some((key) => key === term)) return 0;
  if (keys.some((key) => key.startsWith(term))) return 1;
  if (
    keys.some((key) =>
      key.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(term)),
    )
  )
    return 2;
  return 3;
}

/** The best few, in the server's order within each rank. */
export function bestHits(
  hits: readonly RecordHit[],
  query: string,
): RecordHit[] {
  const term = query.toLowerCase();
  return hits
    .map((hit, index) => ({ hit, index, score: rank(hit, term) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, SHOWN_PER_GROUP)
    .map(({ hit }) => hit);
}
