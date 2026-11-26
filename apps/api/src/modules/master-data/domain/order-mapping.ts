import type { OrderFacts } from "../../orders/domain/order-facts.js";
import type { MasterDataSalesOrder } from "./master-data-reader.js";

/**
 * Master data's view of an order. A sample maps to exactly what the mock of
 * Business Central reports for it. A stored order carries no workflow status
 * here (the orders service overlays it, master data does not), so its capture
 * state is the nearest honest word.
 */
export function toMasterDataSalesOrder(
  facts: OrderFacts,
): MasterDataSalesOrder {
  return {
    no: facts.orderNo,
    customerNo: facts.customerNo,
    externalDocumentNo: facts.externalDocumentNo,
    orderDate: facts.orderDate,
    shipmentDate: facts.shipmentDate,
    status:
      facts.workflowStatus ??
      (facts.captureState === null
        ? ""
        : facts.captureState.charAt(0).toUpperCase() +
          facts.captureState.slice(1)),
    total: facts.total,
    lines: facts.lines.map((line) => ({
      no: line.itemNo,
      qtyToShip: line.qtyToShip,
    })),
    stockShortfall: facts.stockShortfall && { ...facts.stockShortfall },
    overdue: facts.overdue && { ...facts.overdue },
  };
}

/**
 * Whether master data lists the order as one of Business Central's. Samples always
 * are. A stored order is only once it is submitted: a draft is not demand and
 * a void order is gone (ADR 0046), so neither counts as open anywhere.
 */
export function listedInMasterData(facts: OrderFacts): boolean {
  return facts.source === "sample" || facts.captureState === "submitted";
}
