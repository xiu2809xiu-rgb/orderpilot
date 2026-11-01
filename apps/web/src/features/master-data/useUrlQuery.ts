import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { MASTER_DATA_MAX_PAGE_SIZE } from "@orderpilot/shared";
import type { TableFilters, TableQuery } from "@/components/common";

const DEFAULT_PAGE_SIZE = 25;

/** The filters a list accepts, each with the values it allows, or null for any text. */
export type FilterSpec = Readonly<Record<string, readonly string[] | null>>;

function positive(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** What the address bar says. A hand-edited value that means nothing is dropped. */
export function queryFromUrl(
  url: URLSearchParams,
  spec: FilterSpec,
): TableQuery {
  const filters: TableFilters = {};
  for (const [id, allowed] of Object.entries(spec)) {
    const value = url.get(id);
    if (value && (allowed === null || allowed.includes(value))) {
      filters[id] = value;
    }
  }
  const sort = url.get("sort");
  return {
    page: positive(url.get("page"), 1),
    // The API refuses more than its maximum, so a hand-edited link is held to it.
    pageSize: Math.min(
      positive(url.get("pageSize"), DEFAULT_PAGE_SIZE),
      MASTER_DATA_MAX_PAGE_SIZE,
    ),
    search: url.get("search") ?? "",
    sort: sort
      ? {
          columnId: sort,
          direction: url.get("direction") === "desc" ? "desc" : "asc",
        }
      : null,
    filters,
  };
}

export function urlFromQuery(query: TableQuery): URLSearchParams {
  const url = new URLSearchParams();
  if (query.search) url.set("search", query.search);
  for (const [id, value] of Object.entries(query.filters)) {
    if (typeof value === "string") url.set(id, value);
  }
  if (query.sort) {
    url.set("sort", query.sort.columnId);
    url.set("direction", query.sort.direction);
  }
  if (query.page > 1) url.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) {
    url.set("pageSize", String(query.pageSize));
  }
  return url;
}

/**
 * A list's search, filters, sort and page, kept in the address bar, so a link
 * opens a filtered list and the back button works.
 */
export function useUrlQuery(
  spec: FilterSpec,
): [TableQuery, (query: TableQuery) => void] {
  const [url, setUrl] = useSearchParams();
  const query = useMemo(() => queryFromUrl(url, spec), [url, spec]);
  const setQuery = useCallback(
    (next: TableQuery) => {
      setUrl(urlFromQuery(next), { replace: true });
    },
    [setUrl],
  );
  return [query, setQuery];
}

/** The query as the API takes it: page, search, sort and the filters. */
export function apiParams(
  query: TableQuery,
  sortable: readonly string[],
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.search) params.search = query.search;
  for (const [id, value] of Object.entries(query.filters)) {
    if (typeof value === "string") params[id] = value;
  }
  if (query.sort && sortable.includes(query.sort.columnId)) {
    params.sort = query.sort.columnId;
    params.direction = query.sort.direction;
  }
  return params;
}

/** Every row of a list, a page at a time, for an export. */
export async function allPages<Row>(
  fetchPage: (
    page: number,
  ) => Promise<{ data: readonly Row[]; meta: { total: number } }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; ; page++) {
    const { data, meta } = await fetchPage(page);
    rows.push(...data);
    if (data.length === 0 || rows.length >= meta.total) return rows;
  }
}
