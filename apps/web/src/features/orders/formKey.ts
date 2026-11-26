import type { OrderFormInput } from "./orderFormSchema";
import { withoutBlankTail } from "./orderFormValues";

/**
 * What the person typed, as one string: the customer, the PO number, the dates,
 * the prepayment and each line's item, quantity, price and words. Two forms with
 * the same key would send the same body. It leaves out what a poll writes beside
 * the lines (the unit, the stock, the last price), which is not the person's
 * edit, and the version of a draft, which a new order has none of.
 */
export function formKey(values: OrderFormInput): string {
  const typed = withoutBlankTail(values);
  return JSON.stringify([
    typed.customer?.number ?? "",
    typed.externalDocumentNo,
    typed.orderDate,
    typed.shipmentDate,
    typed.prepaymentPercent,
    typed.lines.map((line) => [
      line.item?.number ?? "",
      line.quantity,
      line.unitPrice,
      line.description,
    ]),
  ]);
}
