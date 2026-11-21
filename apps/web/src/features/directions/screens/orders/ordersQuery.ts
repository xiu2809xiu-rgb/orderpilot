import {
  ORDER_CAPTURE_STATES,
  ORDER_SOURCES,
  type OrderCaptureState,
  type OrderSource,
  type Role,
} from "@orderpilot/shared";
import {
  LIFECYCLE_STAGES,
  stageTabOf,
  type LifecycleStageTab,
} from "@/features/order-tracker/trackerParams";
import { isHeldUp, isOpen, positionOf, type OrderRow } from "./orderRow";

/** The four views across the top of the workspace. */
export const VIEWS = ["all", "mine", "held", "stage"] as const;
export type View = (typeof VIEWS)[number];

export const SORT_IDS = [
  "orderNo",
  "customerName",
  "orderDate",
  "shipmentDate",
  "amount",
  "step",
  "entry",
] as const;
export type SortId = (typeof SORT_IDS)[number];
export type SortDirection = "asc" | "desc";
export interface Sort {
  id: SortId;
  direction: SortDirection;
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * Everything the address can say about the list: the view, the search, every
 * filter the two old pages had, the sort and the page. It lives in the address
 * so a link, such as a step on the home screen, opens the same list.
 */
export interface OrdersQuery {
  view: View;
  search: string;
  customer: string | null;
  stage: LifecycleStageTab;
  /** Tracker status codes, comma separated. */
  status: string | null;
  /** A tracker step id, such as `poIn`, from a link on the home screen. */
  step: string | null;
  overdue: boolean;
  exceptions: boolean;
  stock: boolean;
  toConfirm: boolean;
  open: boolean;
  entry: OrderCaptureState | null;
  source: OrderSource | null;
  from: string | null;
  to: string | null;
  sort: Sort | null;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: OrdersQuery = {
  view: "all",
  search: "",
  customer: null,
  stage: "all",
  status: null,
  step: null,
  overdue: false,
  exceptions: false,
  stock: false,
  toConfirm: false,
  open: false,
  entry: null,
  source: null,
  from: null,
  to: null,
  sort: null,
  page: 1,
  pageSize: 25,
};

/** Every filter off: what Clear all sets. The search, the view and the sort stay as they are unless a caller says. */
export const NO_FILTERS: Partial<OrdersQuery> = {
  customer: null,
  stage: "all",
  status: null,
  step: null,
  overdue: false,
  exceptions: false,
  stock: false,
  toConfirm: false,
  open: false,
  entry: null,
  source: null,
  from: null,
  to: null,
};

const isIn = <T extends string>(list: readonly T[], value: string | null) =>
  list.find((candidate) => candidate === value) ?? null;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const flag = (params: URLSearchParams, key: string) =>
  params.get(key) === "true";
const positive = (value: string | null, fallback: number): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

/**
 * The words the old Orders list put in its addresses, and what each is called
 * now. A link, a bookmark or a saved view made before the workspace still
 * opens the same list. A new name wins when an address carries both.
 */
const LEGACY_KEYS: Readonly<Record<string, string>> = {
  search: "q",
  customerNo: "customer",
  captureState: "entry",
  orderDateFrom: "from",
  orderDateTo: "to",
  pageSize: "size",
  direction: "dir",
};

/** The old list sorted by customer number and by entry state; those columns are these now. */
const LEGACY_SORTS: Readonly<Record<string, string>> = {
  customerNo: "customerName",
  captureState: "entry",
};

export function parseQuery(raw: URLSearchParams): OrdersQuery {
  const params = new URLSearchParams(raw);
  for (const [old, current] of Object.entries(LEGACY_KEYS)) {
    const value = params.get(old);
    if (value !== null && !params.has(current)) params.set(current, value);
  }
  const wanted = params.get("sort");
  const sortId = isIn(
    SORT_IDS,
    wanted === null ? null : (LEGACY_SORTS[wanted] ?? wanted),
  );
  const status = params.get("status");
  const from = params.get("from");
  const to = params.get("to");
  const size = positive(params.get("size"), DEFAULT_QUERY.pageSize);
  return {
    view: isIn(VIEWS, params.get("view")) ?? "all",
    search: (params.get("q") ?? "").slice(0, 100),
    customer: params.get("customer"),
    // A status filter names its stage, so the two never disagree.
    stage: status
      ? stageTabOf(status)
      : (isIn(
          ["all", ...LIFECYCLE_STAGES.map((stage) => stage.id)],
          params.get("stage"),
        ) ?? "all"),
    status,
    step: positionOf(params.get("step") ?? "") ? params.get("step") : null,
    overdue: flag(params, "overdue"),
    exceptions: flag(params, "exceptionsOnly"),
    stock: params.get("stock") === "waiting",
    toConfirm: flag(params, "documentToConfirm"),
    open: flag(params, "open"),
    entry: isIn(ORDER_CAPTURE_STATES, params.get("entry")),
    source: isIn(ORDER_SOURCES, params.get("source")),
    from: from && ISO_DAY.test(from) ? from : null,
    to: to && ISO_DAY.test(to) ? to : null,
    sort: sortId
      ? { id: sortId, direction: params.get("dir") === "desc" ? "desc" : "asc" }
      : null,
    page: positive(params.get("page"), 1),
    pageSize: PAGE_SIZES.some((allowed) => allowed === size)
      ? size
      : DEFAULT_QUERY.pageSize,
  };
}

/** Only what differs from the default goes in the address. */
export function toParams(query: OrdersQuery, keep?: URLSearchParams) {
  const params = new URLSearchParams();
  // The `order` of another screen and anything else not ours stays as it was.
  keep?.forEach((value, key) => {
    if (!OWN_KEYS.has(key)) params.set(key, value);
  });
  const set = (key: string, value: string | null) => {
    if (value) params.set(key, value);
  };
  if (query.view !== "all") params.set("view", query.view);
  set("q", query.search.trim());
  set("customer", query.customer);
  if (query.stage !== "all" && !query.status) params.set("stage", query.stage);
  set("status", query.status);
  set("step", query.step);
  if (query.overdue) params.set("overdue", "true");
  if (query.exceptions) params.set("exceptionsOnly", "true");
  if (query.stock) params.set("stock", "waiting");
  if (query.toConfirm) params.set("documentToConfirm", "true");
  if (query.open) params.set("open", "true");
  set("entry", query.entry);
  set("source", query.source);
  set("from", query.from);
  set("to", query.to);
  if (query.sort) {
    params.set("sort", query.sort.id);
    params.set("dir", query.sort.direction);
  }
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_QUERY.pageSize) {
    params.set("size", String(query.pageSize));
  }
  return params;
}

// The old names are ours too: a change rewrites them under the new ones, or a
// cleared filter would be read back from the old name left in the address.
const OWN_KEYS = new Set([
  ...Object.keys(LEGACY_KEYS),
  "view",
  "q",
  "customer",
  "stage",
  "status",
  "step",
  "overdue",
  "exceptionsOnly",
  "stock",
  "documentToConfirm",
  "open",
  "entry",
  "source",
  "from",
  "to",
  "sort",
  "dir",
  "page",
  "size",
]);

/** The statuses of the chosen stage, or every status when no stage is chosen. */
export function statusesOfStage(stage: LifecycleStageTab): readonly string[] {
  const found = LIFECYCLE_STAGES.find((candidate) => candidate.id === stage);
  return found
    ? found.statuses
    : LIFECYCLE_STAGES.flatMap((candidate) => candidate.statuses);
}

/** The one value the Stage and status list shows: a whole stage, one status, or everything. */
export function stageStatusValue(query: OrdersQuery): string {
  if (query.status && !query.status.includes(",")) {
    return `status:${query.status}`;
  }
  return query.stage === "all" ? "all" : `stage:${query.stage}`;
}

/** What choosing a value of that list sets: a stage (and no status), a status, or neither. */
export function fromStageStatus(value: string): Partial<OrdersQuery> {
  if (value.startsWith("status:")) {
    const status = value.slice("status:".length);
    return { status, stage: stageTabOf(status) };
  }
  if (value.startsWith("stage:")) {
    return {
      status: null,
      stage: value.slice("stage:".length) as LifecycleStageTab,
    };
  }
  return { status: null, stage: "all" };
}

export interface Who {
  role: Role | undefined;
}

/**
 * A From after its To. The address can carry one (typed, or a stale link), and
 * the panel says so at the field. The range then filters nothing, rather than
 * empty the list with a span of negative days that no order can be in.
 */
export function rangeReversed(query: Pick<OrdersQuery, "from" | "to">) {
  return query.from !== null && query.to !== null && query.from > query.to;
}

/** Whether a row passes every filter except the view. */
function passes(row: OrderRow, query: OrdersQuery): boolean {
  const search = query.search.trim().toLowerCase();
  if (
    search &&
    ![
      row.orderNo,
      row.externalDocumentNo,
      row.customerNo,
      row.customerName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }
  if (query.customer && row.customerNo !== query.customer) return false;
  if (query.status) {
    const wanted = query.status.split(",");
    if (!row.status || !wanted.includes(row.status.code)) return false;
  } else if (query.stage !== "all") {
    const group = statusesOfStage(query.stage);
    if (!row.status || !group.includes(row.status.code)) return false;
  }
  if (query.step && row.step !== positionOf(query.step)) return false;
  if (query.overdue && row.overdue?.overdue !== true) return false;
  if (query.exceptions && row.openExceptions === 0) return false;
  if (query.stock && row.shortageCount === 0) return false;
  if (query.toConfirm && !row.toConfirm) return false;
  if (query.open && !isOpen(row)) return false;
  if (query.entry && row.captureState !== query.entry) return false;
  if (query.source && row.source !== query.source) return false;
  if (!rangeReversed(query)) {
    if (query.from && row.orderDate.slice(0, 10) < query.from) return false;
    if (query.to && row.orderDate.slice(0, 10) > query.to) return false;
  }
  return true;
}

function inView(row: OrderRow, view: View, who: Who): boolean {
  if (view === "mine")
    return who.role !== undefined && row.ownerRole === who.role;
  if (view === "held") return isHeldUp(row);
  return true;
}

export function filterOrders(
  rows: readonly OrderRow[],
  query: OrdersQuery,
  who: Who,
): OrderRow[] {
  return rows.filter(
    (row) => passes(row, query) && inView(row, query.view, who),
  );
}

export interface ViewCounts {
  all: number;
  mine: number;
  held: number;
}

/** How many orders each view holds under the other filters, so a tab's number is what it opens. */
export function countViews(
  rows: readonly OrderRow[],
  query: OrdersQuery,
  who: Who,
): ViewCounts {
  const rest = rows.filter((row) => passes(row, query));
  return {
    all: rest.length,
    mine: rest.filter((row) => inView(row, "mine", who)).length,
    held: rest.filter((row) => inView(row, "held", who)).length,
  };
}

/** How many orders each stage holds under the other filters, for the stage list. */
export function countStages(
  rows: readonly OrderRow[],
  query: OrdersQuery,
  who: Who,
): Record<LifecycleStageTab, number> {
  const rest = filterOrders(
    rows,
    { ...query, stage: "all", status: null },
    who,
  );
  const counts: Record<LifecycleStageTab, number> = {
    all: rest.length,
    draft: 0,
    pendingApproval: 0,
    processing: 0,
    shipped: 0,
    completed: 0,
  };
  for (const stage of LIFECYCLE_STAGES) {
    counts[stage.id] = rest.filter(
      (row) => row.status && stage.statuses.some((s) => s === row.status?.code),
    ).length;
  }
  return counts;
}

const compare = (a: string | number, b: string | number) =>
  typeof a === "number" && typeof b === "number"
    ? a - b
    : String(a).localeCompare(String(b), "en", { numeric: true });

function keyOf(row: OrderRow, id: SortId): string | number | null {
  switch (id) {
    case "orderNo":
      return row.orderNo;
    case "customerName":
      return row.customerName ?? row.customerNo;
    case "orderDate":
      return row.orderDate;
    case "shipmentDate":
      return row.shipmentDate;
    case "amount":
      return row.amount.masked || row.amount.value === null
        ? null
        : Number(row.amount.value);
    case "step":
      return row.step;
    case "entry":
      return row.captureState;
  }
}

/**
 * The tracker's own order when nothing is chosen: the most overdue first, then
 * the newest. A column sort puts a row without a value last in either direction.
 */
export function sortOrders(
  rows: readonly OrderRow[],
  sort: Sort | null,
): OrderRow[] {
  const copy = [...rows];
  if (!sort) {
    return copy.sort(
      (a, b) =>
        (b.overdue?.daysOverdue ?? 0) - (a.overdue?.daysOverdue ?? 0) ||
        b.orderDate.localeCompare(a.orderDate) ||
        a.orderNo.localeCompare(b.orderNo),
    );
  }
  const sign = sort.direction === "asc" ? 1 : -1;
  return copy.sort((a, b) => {
    const left = keyOf(a, sort.id);
    const right = keyOf(b, sort.id);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return sign * compare(left, right) || a.orderNo.localeCompare(b.orderNo);
  });
}
