import { useMemo } from "react";
import { useOrdersList } from "@/lib/api/generated/endpoints/orders/orders";
import {
  useTrackerFlow,
  useTrackerList,
} from "@/lib/api/generated/endpoints/tracker/tracker";
import { joinOrders, type OrderRow } from "./orderRow";

/** The most the API gives at once. A list this long is read whole, so every view and count is exact. */
export const LOADED = 200;

const KEEP = { query: { placeholderData: <T>(previous: T) => previous } };

/**
 * Every order, read once and joined: the Orders list (the base, with masked
 * amounts), the tracker (status, team, overdue, exceptions), the orders that
 * hold a document to confirm, and the flow that says which step a status is.
 * The views, filters and counts are then worked out here in the browser, so a
 * tab's number is always what it opens. A role that cannot read the tracker
 * still gets its orders, with the tracker's columns empty.
 */
export function useOrderRows() {
  const orders = useOrdersList({ pageSize: LOADED }, KEEP);
  const tracker = useTrackerList({ pageSize: LOADED }, KEEP);
  const toConfirm = useTrackerList(
    { documentToConfirm: "true", pageSize: LOADED },
    KEEP,
  );
  const flow = useTrackerFlow(KEEP);

  const rows = useMemo<OrderRow[]>(
    () =>
      joinOrders({
        orders: orders.data?.data ?? [],
        tracker: tracker.data?.data ?? [],
        toConfirm: new Set(toConfirm.data?.data.map((row) => row.orderNo)),
        flow: flow.data?.data,
      }),
    [orders.data, tracker.data, toConfirm.data, flow.data],
  );

  const total = orders.data?.meta.total ?? 0;
  return {
    rows,
    orders,
    /** The orders list is what the page is made of: until it has answered, there is nothing to show. */
    isPending: orders.isPending,
    error: orders.error,
    /** The tracker did not answer: the rows have no stage, team or overdue flag. */
    trackerMissing: tracker.isError || flow.isError,
    /** The list is longer than the page the API gives. */
    truncated: total > LOADED,
    total,
    refetch: () => {
      void orders.refetch();
      void tracker.refetch();
      void toConfirm.refetch();
      void flow.refetch();
    },
  };
}
