import { useMemo } from "react";
import { hasPermission, useSessionStore } from "@/stores/session";

/** An order's page, for a role that may read orders. */
export function orderHref(orderNo: string): string {
  return `/orders/${encodeURIComponent(orderNo)}`;
}

const TRACKER_LIST = /^\/order-tracker(?=\?|$)/;

/**
 * The Orders address of a list the tracker draws, with the same filters: the
 * workspace reads the tracker's own parameters (status, open, overdue,
 * documentToConfirm, exceptionsOnly). Null for an address that is not the
 * tracker's list.
 */
export function ordersAddressOf(to: string): string | null {
  return TRACKER_LIST.test(to) ? to.replace(TRACKER_LIST, "/orders") : null;
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
      /**
       * The address of a list a feature declared. The tracker's lists lead to
       * Orders for a role that may read them: the tracker has no row in that
       * role's side panel and none of the Orders tools.
       */
      list: (to: string): string => (orders ? ordersAddressOf(to) : null) ?? to,
      /** The orders at one step: `?step=` takes the tracker's step id. */
      step: (stepId: string, statuses: readonly string[]): string =>
        orders
          ? `/orders?step=${stepId}`
          : `/order-tracker?status=${statuses.join(",")}`,
    }),
    [orders, tracker],
  );
}
