import { PREPAYMENT_PERCENT } from "./names.js";
import { hashUnit } from "./random.js";
import type { Customer, Item } from "./types.js";

/** Never below this share over cost, so no line is sold at a loss. */
const MINIMUM_MARGIN = 1.05;

/**
 * What a customer last agreed to pay for an item, in USD. It is a pure
 * function of the seed, the customer and the item, with no reference date in
 * it, so the live lines, the history and the form's reference price all agree
 * and the data stays the same from one day to the next.
 *
 * The item's own `unitPrice` is the catalogue price from Business Central; a
 * customer pays near it, not exactly it:
 * - customers who pay before shipping get a little under, those on credit a
 *   little over;
 * - every customer earns a volume discount of 0 to 3 percent, set by the
 *   customer number modulo 4;
 * - each customer and item pair has its own jitter of about 1.5 percent.
 */
export function agreedPrice(
  seed: number,
  customer: Customer,
  item: Item,
): string {
  const prepays = PREPAYMENT_PERCENT[customer.paymentTermsCode] !== undefined;
  const terms = prepays
    ? 0.96 + 0.03 * hashUnit(seed, "terms", customer.no)
    : 1 + 0.04 * hashUnit(seed, "terms", customer.no);
  const volume = 1 - (Number(customer.no.slice(2)) % 4) / 100;
  const jitter =
    1 + 0.03 * (hashUnit(seed, "pair", customer.no, item.no) - 0.5);
  const price = Number(item.unitPrice) * terms * volume * jitter;
  const floor = Number(item.unitCost) * MINIMUM_MARGIN;
  return Math.max(price, floor).toFixed(2);
}
