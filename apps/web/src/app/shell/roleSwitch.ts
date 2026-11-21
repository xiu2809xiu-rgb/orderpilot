import type { Session } from "@orderpilot/shared";
import type { QueryClient } from "@tanstack/react-query";
import { forgetKeptLists } from "@/features/orders/orderSearches";
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
 * After a sign-in as another role, what the page kept beside the live queries
 * goes too: the possible-match lists, which live for a minute, and what the
 * given client only holds. What is on screen is not touched here. The sign-in
 * answer empties and asks again before the store holds the new person (`begin`
 * in `lib/api/auth.ts`), the one place that can promise no render pairs the
 * new name with the old figures.
 */
export function startAsNewRole(client: QueryClient): Promise<void> {
  forgetKeptLists();
  client.removeQueries({ type: "inactive" });
  return Promise.resolve();
}
