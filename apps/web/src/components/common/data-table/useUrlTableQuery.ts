import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_QUERY, type TableFilters, type TableQuery } from "./types";

function readFilters(
  params: URLSearchParams,
  keys: readonly string[],
): TableFilters {
  const filters: TableFilters = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value === null || value === "") continue;
    filters[key] = value === "true" ? true : value;
  }
  return filters;
}

/**
 * A table's query with its filters in the address bar, so a link can open a
 * filtered list and a reload keeps it. Paging and sort stay in memory. A link
 * can also start the search with `?search=`, which goes from the address once
 * the search changes, so a reload never brings back a search the person
 * cleared. `keys` are the filters a URL may carry: anything else is left alone.
 */
export function useUrlTableQuery(
  keys: readonly string[],
): [TableQuery, (next: TableQuery) => void] {
  const [params, setParams] = useSearchParams();
  const [rest, setRest] = useState<TableQuery>(() => ({
    ...DEFAULT_QUERY,
    search: params.get("search") ?? "",
  }));
  const text = params.toString();
  const query = useMemo(
    () => ({ ...rest, filters: readFilters(new URLSearchParams(text), keys) }),
    [rest, text, keys],
  );
  const setQuery = useCallback(
    (next: TableQuery) => {
      setRest(next);
      setParams(
        (previous) => {
          const out = new URLSearchParams(previous);
          for (const key of keys) {
            const value = next.filters[key];
            if (value === true) out.set(key, "true");
            else if (typeof value === "string") out.set(key, value);
            else out.delete(key);
          }
          if (next.search !== out.get("search")) out.delete("search");
          return out;
        },
        { replace: true },
      );
    },
    [keys, setParams],
  );
  return [query, setQuery];
}
