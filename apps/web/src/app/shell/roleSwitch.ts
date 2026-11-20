import type { Session } from "@orderpilot/shared";
import type { QueryClient } from "@tanstack/react-query";
import { forgetKeptLists } from "@/features/orders/orderSearches";
import { forgetShown } from "@/lib/query";
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

type StayListener = (pathname: string) => void;
const stayListeners = new Set<StayListener>();

/**
 * Says that a change of role has deliberately kept the page at `pathname`. The
 * strip of open records listens: a page the viewer did not leave is theirs to
 * keep as a tab (ADR 0032, decision 2, note of 20 Nov 2026), unlike a page that
 * was only on screen for a moment while the person was being replaced.
 */
export function announceStay(pathname: string): void {
  for (const listener of [...stayListeners]) listener(pathname);
}

/** Listens for `announceStay`. Returns the function that stops listening. */
export function onStay(listener: StayListener): () => void {
  stayListeners.add(listener);
  return () => {
    stayListeners.delete(listener);
  };
}

/**
 * After a sign-in as another role, nothing the old role was shown may stay on
 * screen. What is on screen is asked for again as the new role and what is
 * only kept is dropped (`forgetShown`, which says why emptying the store
 * alone is not enough).
 */
export async function startAsNewRole(client: QueryClient): Promise<void> {
  // The possible-match lists are kept outside the query cache, for a minute.
  forgetKeptLists();
  await forgetShown(client);
}
