import { multiplyDecimal } from "@orderpilot/shared";
import type { Item, SampleOrder } from "@orderpilot/synthetic-data";
import { CARTON } from "./facts-data.js";
import type { FactLine } from "./facts.js";
import { find } from "./pinned.js";
import type { DocumentKind } from "./model.js";

export function linesOf(
  order: SampleOrder,
  kind: DocumentKind,
  items: readonly Item[],
): FactLine[] {
  const { scenario } = order;
  return order.lines.map((line, i) => {
    const item = find(items, (it) => it.no === line.no, `item ${line.no}`);
    let { quantity, unitPrice } = line;
    // The PO prints the agreed price, the line's own. The one planted draft
    // PI prints a higher price on its first line, for the checks to find.
    if (
      kind === "PROFORMA_INVOICE" &&
      scenario.kind === "pi-price-mismatch" &&
      i === 0
    ) {
      unitPrice = scenario.piPrice;
    }
    // The packing list counts what was packed, which is short on the first line.
    if (
      kind === "PACKING_LIST" &&
      scenario.kind === "packing-list-mismatch" &&
      i === 0
    ) {
      quantity = scenario.packed;
    }
    const carton = CARTON[item.category];
    const cartons = Math.ceil(Number(quantity) / carton.pieces);
    return {
      partNumber: item.partNumber,
      description: line.description,
      quantity,
      unitPrice,
      amount: multiplyDecimal(quantity, unitPrice),
      cartons: String(cartons),
      grossKg: (cartons * carton.kg).toFixed(1),
    };
  });
}
