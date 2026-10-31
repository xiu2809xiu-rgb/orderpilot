import type { TableQuery } from "@/components/common";
import type { TrackerListParams } from "@/lib/api/generated/model";

const SORTABLE = new Set([
  "orderNo",
  "customerName",
  "orderDate",
  "shipmentDate",
]);

/** What the server needs for one view of the table. Paging, search, sort and the filter are the server's. */
export function toParams(query: TableQuery): TrackerListParams {
  const params: TrackerListParams = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.search) params.search = query.search;
  if (query.filters.overdue === true) params.overdue = "true";
  if (query.sort && SORTABLE.has(query.sort.columnId)) {
    params.sort = query.sort.columnId as TrackerListParams["sort"];
    params.direction = query.sort.direction;
  }
  return params;
}
