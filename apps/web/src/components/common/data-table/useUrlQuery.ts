import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_QUERY, type TableFilters, type TableQuery } from "./types";

/**
 * The filters a list accepts, each with the values it allows, or null for any
 * text. A plain list of names means "any text" for each.
 */
export type FilterSpec =
  Readonly<Record<string, readonly string[] | null>> | readonly string[];

/** The API refuses a page size over this: a hand-edited address must not reach it. */
export const MAX_PAGE_SIZE = 200;

/** What the master data, tracker and exceptions endpoints take for search. */
export const MAX_SEARCH_LENGTH = 100;
/** What they take for a text filter, unless a list says otherwise. */
export const MAX_FILTER_LENGTH = 60;

export interface UrlQueryOptions {
  /** The page size when the address does not say, or says something the API refuses. */
  pageSize?: number;
  /** Longest search the API takes. Longer text in the address is cut. */
  searchMax?: number;
  /** Longest text for a filter, by filter id. Others use `MAX_FILTER_LENGTH`. */
  filterMax?: Readonly<Record<string, number>>;
}

const MANAGED = ["search", "sort", "direction", "page", "pageSize"] as const;

function normalise(
  spec: FilterSpec,
): Readonly<Record<string, readonly string[] | null>> {
  return Array.isArray(spec)
    ? Object.fromEntries((spec as readonly string[]).map((id) => [id, null]))
    : (spec as Readonly<Record<string, readonly string[] | null>>);
}

function positive(value: string | null, fallback: number, max?: number) {
  const parsed = Number(value);
  const whole = value !== null && Number.isInteger(parsed) && parsed > 0;
  return whole && (max === undefined || parsed <= max) ? parsed : fallback;
}

/**
 * What the address bar says. A hand-edited value that means nothing is
 * dropped or replaced by the default, so a bad link never breaks the page. A
 * filter that takes any text reads "true" as a switch that is on.
 */
export function queryFromUrl(
  url: URLSearchParams,
  spec: FilterSpec,
  {
    pageSize = DEFAULT_QUERY.pageSize,
    searchMax = MAX_SEARCH_LENGTH,
    filterMax = {},
  }: UrlQueryOptions = {},
): TableQuery {
  const filters: TableFilters = {};
  for (const [id, allowed] of Object.entries(normalise(spec))) {
    const value = url.get(id);
    if (!value) continue;
    if (allowed === null) {
      filters[id] =
        value === "true"
          ? true
          : value.slice(0, filterMax[id] ?? MAX_FILTER_LENGTH);
    } else if (allowed.includes(value)) filters[id] = value;
  }
  const sort = url.get("sort");
  return {
    // The API reads a page as a safe integer: 1e20 in the address is refused.
    page: positive(url.get("page"), 1, Number.MAX_SAFE_INTEGER),
    pageSize: positive(url.get("pageSize"), pageSize, MAX_PAGE_SIZE),
    search: (url.get("search") ?? "").slice(0, searchMax),
    sort: sort
      ? {
          columnId: sort,
          direction: url.get("direction") === "desc" ? "desc" : "asc",
        }
      : null,
    filters,
  };
}

/**
 * The query written into an address, over the address it came from: a
 * parameter this list does not manage, such as `?tab=`, is left alone.
 */
export function urlFromQuery(
  previous: URLSearchParams,
  query: TableQuery,
  spec: FilterSpec,
  { pageSize = DEFAULT_QUERY.pageSize }: UrlQueryOptions = {},
): URLSearchParams {
  const url = new URLSearchParams(previous);
  for (const key of [...MANAGED, ...Object.keys(normalise(spec))]) {
    url.delete(key);
  }
  if (query.search) url.set("search", query.search);
  for (const id of Object.keys(normalise(spec))) {
    const value = query.filters[id];
    if (value === true) url.set(id, "true");
    else if (typeof value === "string" && value !== "") url.set(id, value);
  }
  if (query.sort) {
    url.set("sort", query.sort.columnId);
    url.set("direction", query.sort.direction);
  }
  if (query.page > 1) url.set("page", String(query.page));
  if (query.pageSize !== pageSize) url.set("pageSize", String(query.pageSize));
  return url;
}

/**
 * A list's search, filters, sort, page and page size, kept in the address
 * bar. A link opens a filtered list, and a reload brings the same view back.
 * Pass the same `spec` every render (a constant): it decides which filters
 * the address may carry.
 */
export function useUrlQuery(
  spec: FilterSpec,
  options: UrlQueryOptions = {},
): [TableQuery, (query: TableQuery) => void] {
  const [url, setUrl] = useSearchParams();
  const { pageSize, searchMax, filterMax } = options;
  const query = useMemo(
    () =>
      queryFromUrl(url, spec, {
        ...(pageSize ? { pageSize } : {}),
        ...(searchMax ? { searchMax } : {}),
        ...(filterMax ? { filterMax } : {}),
      }),
    [url, spec, pageSize, searchMax, filterMax],
  );
  const setQuery = useCallback(
    (next: TableQuery) => {
      setUrl((previous) => urlFromQuery(previous, next, spec, { pageSize }), {
        replace: true,
      });
    },
    [setUrl, spec, pageSize],
  );
  return [query, setQuery];
}

/** The query as the API takes it: page, search, sort and the filters that are text. */
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

/** Every row of a list, a page at a time, for an export or a print. */
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
