import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router";
import { parseQuery, toParams, type OrdersQuery } from "./ordersQuery";

/**
 * The list's query, kept in the address so a link opens the same list. A change
 * goes back to the first page unless it names a page. Two changes in quick
 * succession both land: the router answers a little later, so each change
 * builds on the last one asked for, not on the last one drawn.
 */
export function useOrdersQuery() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseQuery(params), [params]);
  const latest = useRef({ query, params });
  useEffect(() => {
    latest.current = { query, params };
  }, [query, params]);

  const change = useCallback(
    (patch: Partial<OrdersQuery>) => {
      const next = { ...latest.current.query, page: 1, ...patch };
      const nextParams = toParams(next, latest.current.params);
      latest.current = { query: next, params: nextParams };
      setParams(nextParams, { replace: true });
    },
    [setParams],
  );
  return { query, change };
}
