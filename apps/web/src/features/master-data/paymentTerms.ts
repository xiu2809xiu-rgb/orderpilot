import type { TFunction } from "i18next";

// Business Central keeps terms as codes. This is the one place that says what
// each means: the value is the key of its words in the locale file.
const WORDS_OF_CODE: ReadonlyMap<string, string> = new Map([
  ["30 DAYS", "days30"],
  ["60 DAYS", "days60"],
  ["PREPAID", "prepaid"],
  ["50% ADVANCE", "advance50"],
  ["30% DEPOSIT", "deposit30"],
  ["LC AT SIGHT", "lcAtSight"],
]);

/** "30% deposit" from "30% DEPOSIT". A code that is not listed is shown as it is, never guessed. */
export function paymentTermsLabel(t: TFunction, code: string): string {
  const words = WORDS_OF_CODE.get(code.trim().toUpperCase());
  return words ? t(`terms.${words}`) : code;
}

/** The codes this page can word, so that a test can hold the list to the locale file. */
export const KNOWN_PAYMENT_TERMS: readonly string[] = [...WORDS_OF_CODE.keys()];
