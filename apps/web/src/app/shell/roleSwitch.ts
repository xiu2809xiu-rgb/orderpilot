import type { Session } from "@orderpilot/shared";
import type { QueryClient } from "@tanstack/react-query";
import { hasPermission } from "@/stores/session";

// One order's page: /orders/<number>. "new" is the entry form, not an order.
const ORDER_PAGE = /^\/orders\/(?!new\/?$)[^/]+\/?$/;

/**
 * Where to go after signing in as another role. Someone who follows one order
 * from team to team stays on that order's page, as long as the new role may
 * open orders (the same test as the route guard, on the new session); every
 * other page goes Home, because the new role may not have it, or it may not
 * mean the same thing to them.
 */
export function landingAfterSwitch(pathname: string, session: Session): string {
  const staysOnOrder =
    ORDER_PAGE.test(pathname) && hasPermission(session, "orders.read");
  return staysOnOrder ? pathname : "/";
}

/**
 * After a sign-in as another role, nothing the old role was shown may stay on
 * screen. Emptying the cache alone does not do that: a list that is on screen
 * keeps the query it already holds, so switching role on Home left the old
 * role's tasks under the new role's name until a reload. So what is on screen
 * is put back to loading and asked for again as the new role, and what is only
 * cached is dropped. A request sent as the old role may still be on its way:
 * it is stopped first, so its answer cannot arrive afterwards.
 */
export async function startAsNewRole(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.removeQueries({ type: "inactive" });
  // Not awaited: the new role's page should open at once, and fill as it loads.
  void client.resetQueries();
}
