/**
 * Lower case, with every run of punctuation and spaces as one space, so
 * "E-mail" and "e mail" meet and a query of spaces folds to nothing.
 */
const fold = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** What was typed, without the spaces around it or doubled inside it. */
export function trimQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Whether every word typed starts a word of the texts. The palette filters
 * pages and actions itself instead of leaving it to cmdk, whose fuzzy score
 * lets "kpi" match "Use the dark theme" (k, p and i all occur in it).
 */
export function matchesQuery(query: string, texts: readonly string[]): boolean {
  const words = fold(query);
  if (!words) return true;
  const haystack = ` ${fold(texts.join(" "))}`;
  return words.split(" ").every((word) => haystack.includes(` ${word}`));
}
