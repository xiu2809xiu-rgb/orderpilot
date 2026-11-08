import { DUPLICATE_ORDER_PATH } from "@orderpilot/shared";
import { ConflictError, DomainError } from "../../../common/domain-error.js";

/**
 * The database refused a write through a unique key. The service decides
 * whether that is a duplicate order or something else, because only it can read
 * after the transaction that failed.
 */
export class OrderConflictError extends ConflictError {}

/**
 * One customer and one PO number is one order. The 409 names the existing
 * order as the message of an issue on `DUPLICATE_ORDER_PATH`, so the form can
 * link to it without a second envelope.
 */
export class DuplicateOrderError extends DomainError {
  constructor(poNumber: string, existingOrderNo: string) {
    const message = `This customer already has an order with PO number ${poNumber}.`;
    super("CONFLICT", message, [
      { path: "externalDocumentNo", message },
      { path: DUPLICATE_ORDER_PATH, message: existingOrderNo },
    ]);
  }
}
