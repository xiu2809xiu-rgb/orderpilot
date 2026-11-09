import type { FilterChip, TableQuery } from "@/components/common";
import type { TrackerListParams } from "@/lib/api/generated/model";

const SORTABLE = new Set([
  "orderNo",
  "customerName",
  "orderDate",
  "shipmentDate",
]);

/** The filters a link can carry, such as a home tile or a flow step. */
export const TRACKER_URL_FILTERS = [
  "status",
  "open",
  "overdue",
  "documentToConfirm",
] as const;

/**
 * The sample status codes grouped into the five lifecycle stages the tracker's
 * top tabs show. This is a UI-only grouping for the prototype, built the same
 * way `MOCK_SALES_FLOW` groups them into the nine sales steps: it goes once
 * area 2's state machine reports a real stage on each order, and the tabs
 * read that instead.
 */
export const LIFECYCLE_STAGES = [
  {
    id: "draft",
    statuses: ["sample-po-received", "sample-extracted-awaiting-review"],
  },
  {
    id: "pendingApproval",
    statuses: ["sample-short-stock", "sample-pending-approval"],
  },
  {
    id: "processing",
    statuses: [
      "sample-pi-to-send",
      "sample-awaiting-payment",
      "sample-ready-to-pick",
      "sample-packing-list-mismatch",
    ],
  },
  {
    id: "shipped",
    statuses: ["sample-shipped", "sample-awb-overdue"],
  },
  {
    id: "completed",
    statuses: ["sample-invoiced", "sample-closed"],
  },
] as const satisfies readonly { id: string; statuses: readonly string[] }[];

export type LifecycleStageId = (typeof LIFECYCLE_STAGES)[number]["id"];
/** The top tabs' value: one of the five stages, or "all" for no status filter. */
export type LifecycleStageTab = LifecycleStageId | "all";

/**
 * Which stage tab the current status filter sits in: every code the filter
 * holds must belong to that one stage, whether the filter is the stage's
 * whole group (the tab itself was clicked) or one status within it (the
 * tab's dropdown narrowed it). "all" when it names none of the five groups,
 * or when there is none.
 */
export function stageTabOf(status: string | undefined): LifecycleStageTab {
  if (!status) return "all";
  const codes = status.split(",");
  if (codes.length === 0) return "all";
  const stage = LIFECYCLE_STAGES.find((candidate) =>
    codes.every((code) => candidate.statuses.includes(code)),
  );
  return stage?.id ?? "all";
}

/** The stage's codes, joined: what its tab itself sets as the status filter. */
export function groupStatusOf(stage: LifecycleStageId): string {
  const found = LIFECYCLE_STAGES.find((candidate) => candidate.id === stage);
  return (found?.statuses ?? []).join(",");
}

/**
 * The one status a stage's dropdown has narrowed the filter to, or `undefined`
 * when the filter names the stage's whole group (or something else).
 */
export function singleStatusWithin(
  stage: LifecycleStageId,
  status: string | undefined,
): string | undefined {
  if (!status) return undefined;
  const codes = status.split(",");
  if (codes.length !== 1) return undefined;
  const group = LIFECYCLE_STAGES.find((candidate) => candidate.id === stage);
  return group?.statuses.includes(codes[0]) ? codes[0] : undefined;
}

/** A status filter holds several comma-separated codes: the API takes up to 400 characters. */
export const TRACKER_URL_OPTIONS = { filterMax: { status: 400 } } as const;

/** The active filters in words, with their status codes as Spectra's staff say them. */
export function trackerChips(
  filters: TableQuery["filters"],
  t: (key: string, options?: Record<string, unknown>) => string,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (typeof filters.status === "string") {
    const statuses = filters.status
      .split(",")
      .map((code) => t(`list.statuses.${code}`, { defaultValue: code }))
      .join(", ");
    chips.push({ id: "status", label: statuses });
  }
  if (filters.open === true) {
    chips.push({ id: "open", label: t("list.chips.open") });
  }
  if (filters.documentToConfirm === true) {
    chips.push({
      id: "documentToConfirm",
      label: t("list.chips.documentToConfirm"),
    });
  }
  if (filters.overdue === true) {
    chips.push({ id: "overdue", label: t("list.chips.overdue") });
  }
  return chips;
}

/** What the server needs for one view of the table. Paging, search, sort and the filter are the server's. */
export function toParams(query: TableQuery): TrackerListParams {
  const params: TrackerListParams = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.search) params.search = query.search;
  if (query.filters.overdue === true) params.overdue = "true";
  if (query.filters.open === true) params.open = "true";
  if (query.filters.documentToConfirm === true) {
    params.documentToConfirm = "true";
  }
  if (typeof query.filters.status === "string") {
    params.status = query.filters.status;
  }
  if (query.sort && SORTABLE.has(query.sort.columnId)) {
    params.sort = query.sort.columnId as TrackerListParams["sort"];
    params.direction = query.sort.direction;
  }
  return params;
}
