import type { SavedView, TableQuery } from "@/components/common";
import {
  DEFAULT_QUERY,
  parseQuery,
  toParams,
  type OrdersQuery,
} from "./ordersQuery";

/**
 * A saved view is the app's own kind: a name, a search, filters and a sort,
 * and the columns. The orders workspace has more filters than a table query
 * can name one by one, so they are kept as the address parameters they
 * already are, and read back through the same parser the address uses.
 */
export function toSavedQuery(query: OrdersQuery): TableQuery {
  const params = toParams({ ...query, search: "", sort: null, page: 1 });
  return {
    page: 1,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sort
      ? { columnId: query.sort.id, direction: query.sort.direction }
      : null,
    filters: Object.fromEntries(params),
  };
}

export function fromSavedView(view: SavedView): OrdersQuery {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(view.filters)) {
    if (typeof value === "string") params.set(key, value);
  }
  if (view.search) params.set("q", view.search);
  if (view.sort) {
    params.set("sort", view.sort.columnId);
    params.set("dir", view.sort.direction);
  }
  return { ...DEFAULT_QUERY, ...parseQuery(params) };
}
