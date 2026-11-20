/**
 * The names that nearly match what was typed, for a lookup that found little.
 * Records are still matched on their numbers: this only offers a look-alike
 * name to a person, who decides. It is a plain edit distance over the words of
 * a name, so one or two slipped, missing or swapped characters still find it.
 */

/**
 * Slips allowed for a word of this length: short words must match exactly, and
 * two slips are for words of eight letters or more, or a name with only a few
 * letters changed would match half the list.
 */
function allowedSlips(length: number): number {
  if (length <= 3) return 0;
  return length <= 7 ? 1 : 2;
}

/** Letters and digits only, in lower case, one word at a time. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "");
}

/**
 * Edit distance where a swap of two neighbours counts as one slip, so
 * "Meridain" is one slip from "Meridian".
 */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => d[i]?.[j] ?? 0;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
        at(i - 1, j - 1) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = d[i];
      if (row) row[j] = best;
    }
  }
  return at(rows - 1, cols - 1);
}

/** Slips between one typed word and a name's word, or null when too far apart. */
function wordSlips(typed: string, word: string): number | null {
  // A word still being typed is compared with the same number of letters.
  const slips = Math.min(
    editDistance(typed, word),
    editDistance(typed, word.slice(0, typed.length)),
  );
  return slips <= allowedSlips(typed.length) ? slips : null;
}

/**
 * How many slips separate the typed text from a name: every typed word has to
 * be close to some word of the name. Null means the name is not close.
 */
export function nameSlips(typed: string, name: string): number | null {
  const wanted = words(typed);
  const have = words(name);
  if (wanted.length === 0 || wanted.length > 5 || have.length === 0) {
    return null;
  }
  let total = 0;
  for (const word of wanted) {
    let best: number | null = null;
    for (const candidate of have) {
      const slips = wordSlips(word, candidate);
      if (slips !== null && (best === null || slips < best)) best = slips;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

/** The closest names first, at most `limit`, never one the search already found. */
export function closeNames<T extends { number: string; name: string }>(
  typed: string,
  records: readonly T[],
  options: { exclude?: ReadonlySet<string>; limit?: number } = {},
): T[] {
  const { exclude = new Set<string>(), limit = 5 } = options;
  return records
    .flatMap((record) => {
      if (exclude.has(record.number)) return [];
      const slips = nameSlips(typed, record.name);
      return slips === null ? [] : [{ record, slips }];
    })
    .sort(
      (x, y) =>
        x.slips - y.slips ||
        x.record.name.localeCompare(y.record.name, "en") ||
        x.record.number.localeCompare(y.record.number, "en"),
    )
    .slice(0, limit)
    .map((entry) => entry.record);
}
