import type { MasterMatch } from "@orderpilot/shared";

export interface Named {
  readonly no: string;
  readonly name: string;
}

function words(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 0),
  );
}

/** Shared words over all words, 0 to 1. Case and punctuation do not count. */
export function nameSimilarity(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Other records whose names look like this one. A match is made on the
 * Navision number alone; this only lists names a person may want to check,
 * so a look-alike is shown as a possible match and never used as one.
 */
export function lookAlikes(
  printedName: string,
  candidates: readonly Named[],
  ownNo: string,
  options: { threshold?: number; limit?: number } = {},
): MasterMatch["possibleMatches"] {
  const { threshold = 0.5, limit = 3 } = options;
  return candidates
    .filter((c) => c.no !== ownNo)
    .map((c) => ({ c, score: nameSimilarity(printedName, c.name) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score || a.c.no.localeCompare(b.c.no))
    .slice(0, limit)
    .map(({ c }) => ({ no: c.no, name: c.name }));
}
