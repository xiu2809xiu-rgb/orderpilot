import { compareDecimal, type SalesOrderQuery } from "@orderpilot/shared";
import type { OrderEntry } from "./order-entry.js";

const contains = (text: string, search: string): boolean =>
  text.toLowerCase().includes(search.toLowerCase());

/**
 * The filters of the Orders list, applied to the whole set before paging.
 *
 * `canSeeAmount` is false for a role whose amounts are masked: an amount
 * range would let it probe the hidden value, so it is ignored.
 */
export function filterOrders(
  entries: readonly OrderEntry[],
  query: SalesOrderQuery,
  canSeeAmount: boolean,
): OrderEntry[] {
  const search = query.search?.trim();
  return entries.filter(({ facts, shortages }) => {
    if (
      search &&
      ![facts.orderNo, facts.customerNo, facts.externalDocumentNo].some(
        (text) => contains(text, search),
      )
    )
      return false;
    if (query.customerNo && facts.customerNo !== query.customerNo) return false;
    // A sample has no capture state, so it never matches one.
    if (query.captureState && facts.captureState !== query.captureState)
      return false;
    if (query.source && facts.source !== query.source) return false;
    if (query.orderDateFrom && facts.orderDate < query.orderDateFrom)
      return false;
    if (query.orderDateTo && facts.orderDate > query.orderDateTo) return false;
    if (query.stock === "waiting" && shortages.length === 0) return false;
    if (canSeeAmount) {
      if (query.amountFrom && compareDecimal(facts.total, query.amountFrom) < 0)
        return false;
      if (query.amountTo && compareDecimal(facts.total, query.amountTo) > 0)
        return false;
    }
    return true;
  });
}
