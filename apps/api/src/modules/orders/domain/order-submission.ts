import type {
  HandoffPerson,
  HandoffRequest,
  OrderSubmitted,
} from "./order-handoff.js";
import type { SalesOrder } from "./sales-order.js";

/**
 * The fact that tells area 2's workflow an order was submitted (ADR 0072).
 * Built from the stored order and the request alone. It reads no line and no
 * unit price: the total is a decimal string, as the port says.
 */
export function submissionFact(
  order: SalesOrder,
  by: HandoffPerson,
  at: Date,
  request: HandoffRequest,
): OrderSubmitted {
  return {
    orderNo: order.orderNo,
    customerNo: order.customerNo,
    submittedBy: by,
    submittedAt: at,
    total: order.total,
    prepaymentPercent: order.prepaymentPercent,
    poVersionNo: order.poVersionNo,
    request,
  };
}
