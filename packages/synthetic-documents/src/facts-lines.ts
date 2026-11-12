import { multiplyDecimal } from "@orderpilot/shared";
import type { Item, SampleOrder } from "@orderpilot/synthetic-data";
import { CARTON } from "./facts-data.js";
import type { FactLine, Figures, PlantedRecord } from "./facts-base.js";
import type { LegacyKind } from "./model.js";

/**
 * The lines a document of this kind prints. With `honest` the planted
 * differences are left out, which is how a planted record knows what the
 * document should have said.
 */
export function linesOf(
  order: SampleOrder,
  kind: LegacyKind,
  itemOf: (no: string) => Item,
  honest = false,
): FactLine[] {
  const { scenario } = order;
  return order.lines.map((line, i) => {
    const item = itemOf(line.no);
    let { quantity, unitPrice } = line;
    // The PO prints the agreed price, the line's own. The one planted draft
    // PI prints a higher price on its first line, for the checks to find.
    if (
      !honest &&
      kind === "PROFORMA_INVOICE" &&
      scenario.kind === "pi-price-mismatch" &&
      i === 0
    ) {
      unitPrice = scenario.piPrice;
    }
    // The packing list counts what was packed, which is short on the first line.
    if (
      !honest &&
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

type Value = PlantedRecord["values"][number];

/** The values that differ between what is printed and what it should say, the ones the mistake feeds. */
function differing(
  printed: Figures,
  honest: Figures,
  picks: readonly (readonly [string, (f: Figures) => string | undefined])[],
): Value[] {
  const out: Value[] = [];
  for (const [fieldId, read] of picks) {
    const was = read(printed);
    const should = read(honest);
    if (was !== undefined && should !== undefined && was !== should) {
      out.push({ fieldId, printed: was, expected: should });
    }
  }
  return out;
}

/**
 * The record of what a scenario made the renderer print wrong, with the
 * fields it feeds. A dependant is listed only when it really differs: a
 * short count may fill the same cartons.
 */
export function plantedOf(
  scenario: SampleOrder["scenario"],
  kind: LegacyKind,
  printed: Figures,
  honest: Figures,
): PlantedRecord | null {
  if (kind === "PROFORMA_INVOICE" && scenario.kind === "pi-price-mismatch") {
    return {
      kind: "unitPrice",
      lineIndex: 0,
      primaryFieldId: "lines.unitPrice[0]",
      values: differing(printed, honest, [
        ["lines.unitPrice[0]", (f) => f.lines[0]?.unitPrice],
        ["lines.amount[0]", (f) => f.lines[0]?.amount],
        ["total", (f) => f.totals.amount],
        ["amountDue", (f) => f.due?.amount],
        ["balanceDue", (f) => f.due?.balance],
      ]),
    };
  }
  if (kind === "PACKING_LIST" && scenario.kind === "packing-list-mismatch") {
    return {
      kind: "quantity",
      lineIndex: 0,
      primaryFieldId: "lines.quantity[0]",
      values: differing(printed, honest, [
        ["lines.quantity[0]", (f) => f.lines[0]?.quantity],
        ["lines.cartons[0]", (f) => f.lines[0]?.cartons],
        ["lines.grossWeight[0]", (f) => f.lines[0]?.grossKg],
        ["totalQuantity", (f) => f.totals.quantity],
        ["totalCartons", (f) => f.totals.cartons],
        ["totalGrossWeight", (f) => f.totals.grossKg],
      ]),
    };
  }
  return null;
}
