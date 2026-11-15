import { useMemo } from "react";
import { useSessionStore } from "@/stores/session";
import { filterOrders, parseQuery } from "./ordersQuery";
import { useOrderRows } from "./useOrderRows";

/**
 * How many orders the Orders workspace shows for an address's filters: the
 * workspace's own rows and its own filter, so a home tile's figure is the
 * number the list says when the tile opens it. The tracker's own total would
 * miss the orders it does not know (a draft entered here is open to Orders and
 * absent from the tracker). Without the tracker's answer every status is
 * missing, so that is a failure, not a count of nothing.
 */
export function useOrdersCount(search: string, enabled: boolean) {
  const data = useOrderRows(enabled);
  const role = useSessionStore((state) => state.session?.user.role);
  const count = useMemo(
    () =>
      filterOrders(data.rows, parseQuery(new URLSearchParams(search)), {
        role,
      }).length,
    [data.rows, search, role],
  );
  const failed = data.orders.isError || data.trackerMissing;
  return {
    isPending: enabled && data.orders.isPending && !failed,
    isError: failed,
    data: count,
    refetch: data.refetch,
  };
}
