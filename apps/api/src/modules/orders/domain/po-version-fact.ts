import type {
  HandoffPerson,
  HandoffRequest,
  PoVersionConfirmed,
} from "./order-handoff.js";
import type { SalesOrder } from "./sales-order.js";

/**
 * The fact that tells area 2's workflow a revised PO was confirmed (ADR 0072,
 * 0074). Built from the two orders and the request alone: no line, no unit
 * price, no difference, no customer and no PO number. The total is a decimal
 * string, as the port says.
 */
export function poVersionFact(
  stored: SalesOrder,
  revised: SalesOrder,
  by: HandoffPerson,
  at: Date,
  request: HandoffRequest,
): PoVersionConfirmed {
  return {
    orderNo: revised.orderNo,
    poVersionNo: revised.poVersionNo,
    supersedesPoVersionNo: stored.poVersionNo,
    confirmedBy: by,
    confirmedAt: at,
    total: revised.total,
    prepaymentPercent: revised.prepaymentPercent,
    request,
  };
}
