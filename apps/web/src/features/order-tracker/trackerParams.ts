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
