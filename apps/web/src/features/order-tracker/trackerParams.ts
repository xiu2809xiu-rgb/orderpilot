import type { TableQuery } from "@/components/common";
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

/** A status filter holds several comma-separated codes: the API takes up to 400 characters. */
export const TRACKER_URL_OPTIONS = { filterMax: { status: 400 } } as const;

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
