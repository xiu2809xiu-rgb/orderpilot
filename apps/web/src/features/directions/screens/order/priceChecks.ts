import type { CheckResult } from "@orderpilot/shared";

/** A rule on a unit price or a unit cost: `mock.sample-price`, and the like. */
const PRICE_RULE = /(price|cost)$/;
/** Where a check read a price, as the tracker words the place: "item I-0075: unit price". */
const PRICE_PLACE = /\b(price|cost|amount)\b/;

/**
 * Whether a check is about money, judged from what the check carries: its rule
 * id ends in "price" or "cost", or one of its evidence places names a unit
 * price, a price or an amount. A quantity or a number is not.
 */
export function isPriceCheck(check: CheckResult): boolean {
  return (
    PRICE_RULE.test(check.ruleId) ||
    check.evidence.some((place) => PRICE_PLACE.test(place.location))
  );
}
