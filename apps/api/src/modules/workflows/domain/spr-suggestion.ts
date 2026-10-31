import { addDecimal, compareDecimal, type SprBasis } from "@orderpilot/shared";

/** The Navision figures for one item, plus what the order wants of it. */
export interface StockFigures {
  readonly ordered: string;
  readonly inventory: string;
  readonly qtyOnSalesOrder: string;
  readonly qtyOnPurchOrder: string;
}

function negate(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

/**
 * The SPR pre-fill: a suggestion, never a decision. It works out how short an
 * order leaves the stock and proposes buying that much, for a person to
 * approve or change.
 *
 * Only the arithmetic lives here. When to raise an SPR at all (the trigger, a
 * safety stock, rounding to the vendor's pack size, the choice of vendor) is
 * the SPR rules, which are Azri's to build.
 */
export const SprSuggestion = {
  /** Inventory, minus Qty. on Sales Order, plus Qty. on Purch. Order. */
  availableStock(
    figures: Pick<
      StockFigures,
      "inventory" | "qtyOnSalesOrder" | "qtyOnPurchOrder"
    >,
  ): string {
    const afterSales = addDecimal(
      figures.inventory,
      negate(figures.qtyOnSalesOrder),
    );
    return addDecimal(afterSales, figures.qtyOnPurchOrder);
  },

  /** The figures behind a suggestion, or null when the stock already covers the order. */
  fromShortfall(figures: StockFigures): SprBasis | null {
    const availableStock = SprSuggestion.availableStock(figures);
    const shortfall = addDecimal(figures.ordered, negate(availableStock));
    if (compareDecimal(shortfall, "0") <= 0) return null;
    return { ...figures, availableStock, shortfall };
  },
};
