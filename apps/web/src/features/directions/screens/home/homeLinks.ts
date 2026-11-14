import { useMemo } from "react";
import { hasPermission, useSessionStore } from "@/stores/session";

/** An order's page, for a role that may read orders. */
export function orderHref(orderNo: string): string {
  return `/orders/${encodeURIComponent(orderNo)}`;
}

/**
 * Where an order and a step of the flow lead from the home page, for the
 * signed-in role. The Orders pages need `orders.read`; a role without it is
 * sent to the nearest page it may open, so no link on the home page lands on
 * a refusal.
 */
export function useOrderLinks() {
  const session = useSessionStore((state) => state.session);
  const orders = hasPermission(session, "orders.read");
  const tracker = hasPermission(session, "tracker.read");
  return useMemo(
    () => ({
      order: (orderNo: string): string => {
        const no = encodeURIComponent(orderNo);
        if (orders) return orderHref(orderNo);
        return tracker ? `/order-tracker/${no}` : `/workflows/orders/${no}`;
      },
      /** The orders at one step: `?step=` takes the tracker's step id. */
      step: (stepId: string, statuses: readonly string[]): string =>
        orders
          ? `/orders?step=${stepId}`
          : `/order-tracker?status=${statuses.join(",")}`,
    }),
    [orders, tracker],
  );
}
