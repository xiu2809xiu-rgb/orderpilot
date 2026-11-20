import type { CheckResult } from "@orderpilot/shared";

/**
 * Words that name money. Matched anywhere in the word and in any case, so
 * `mock.sample-price`, `unitCost` and "Amount due" are all caught: the cover
 * fails closed, and a word that merely looks like one costs a masked figure,
 * not a leaked price. "value" is left out on purpose: the sample quantity
 * check's tolerance label reads "(sample value)".
 */
const MONEY = /price|cost|amount/i;
/** A total is money unless the same text says what is totalled. */
const TOTAL = /total/i;
/** What is counted, not paid: a text that says one of these is about a quantity. */
const COUNTED =
  /\b(quantity|quantities|unit|units|carton|cartons|piece|pieces)\b/i;

function aboutMoney(text: string): boolean {
  return MONEY.test(text) || (TOTAL.test(text) && !COUNTED.test(text));
}

/**
 * Whether a check is about money, judged from what the check carries: its rule
 * id, its rule label, its tolerance label or one of its evidence places says
 * price, cost or amount, or says total without saying a quantity. Each text is
 * read on its own, so "Total quantity" stays visible for a warehouse while
 * "Invoice total against the PI" is covered.
 */
export function isPriceCheck(check: CheckResult): boolean {
  return [
    check.ruleId,
    check.ruleLabel,
    check.tolerance.label,
    ...check.evidence.map((place) => place.location),
  ].some(aboutMoney);
}
