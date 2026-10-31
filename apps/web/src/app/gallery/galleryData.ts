import type { TableQuery } from "@/components/common";
import type { StatusTone } from "@/components/common";

// Synthetic data for the component gallery. None of it is real.
export const GALLERY_NOW = new Date("2026-11-01T09:00:00Z");

export type DemoStatus = "draft" | "waiting" | "released" | "blocked";

export interface DemoOrder {
  id: string;
  reference: string;
  customer: string;
  status: DemoStatus;
  total: number;
  active: boolean;
  updatedAt: string;
}

export const STATUS_TONE: Record<DemoStatus, StatusTone> = {
  draft: "neutral",
  waiting: "warning",
  released: "success",
  blocked: "danger",
};

const CUSTOMERS = [
  "Harbour Foods Example",
  "Pinewood Supplies Example",
  "Lakeside Trading Example",
  "Summit Retail Example",
  "Coastal Provisions Example",
  "Orchard Goods Example",
];
const STATUSES: DemoStatus[] = ["draft", "waiting", "released", "blocked"];

export const DEMO_ORDERS: DemoOrder[] = Array.from(
  { length: 47 },
  (_, index) => {
    const number = String(index + 1).padStart(4, "0");
    return {
      id: `demo-${number}`,
      reference: `SO-20261030-${number}`,
      customer: CUSTOMERS[index % CUSTOMERS.length] ?? "",
      status: STATUSES[(index * 7) % STATUSES.length] ?? "draft",
      total: 120 + ((index * 937) % 4800) + (index % 4) * 0.5,
      active: index % 5 !== 0,
      updatedAt: new Date(
        GALLERY_NOW.getTime() - (index + 1) * 47 * 60_000,
      ).toISOString(),
    };
  },
);

const SORTABLE = ["reference", "customer", "total", "updatedAt"] as const;
type SortKey = (typeof SORTABLE)[number];

/** Stands in for the server: search, filter, sort and page, as an API would. */
export function serveOrders(query: TableQuery) {
  const needle = query.search.trim().toLowerCase();
  let rows = DEMO_ORDERS.filter(
    (order) =>
      (needle === "" ||
        `${order.reference} ${order.customer}`
          .toLowerCase()
          .includes(needle)) &&
      (query.filters.active !== true || order.active) &&
      (query.filters.status === undefined ||
        query.filters.status === order.status),
  );
  const sort = query.sort;
  const key = SORTABLE.find((candidate) => candidate === sort?.columnId);
  if (sort && key) {
    rows = [...rows].sort((a, b) => compare(a, b, key));
    if (sort.direction === "desc") rows.reverse();
  }
  const start = (query.page - 1) * query.pageSize;
  return {
    rows: rows.slice(start, start + query.pageSize),
    total: rows.length,
  };
}

function compare(a: DemoOrder, b: DemoOrder, key: SortKey): number {
  if (a[key] < b[key]) return -1;
  return a[key] > b[key] ? 1 : 0;
}
