import type { PoVersionDifferences } from "@orderpilot/shared";
import type { TFunction } from "i18next";

/**
 * How a value that may have changed reads: "from to to" when both sides exist
 * and differ, the one side that exists when the line was added or removed, and
 * the value alone when nothing changed.
 */
export function changeText(
  t: TFunction,
  side: { from: string | null; to: string | null; changed: boolean },
  format: (value: string) => string,
): string {
  const { from, to, changed } = side;
  if (changed && from !== null && to !== null) {
    return t("order.versions.change", {
      from: format(from),
      to: format(to),
    });
  }
  const only = to ?? from;
  return only === null ? "" : format(only);
}

/**
 * The counts of a differences view as one sentence, in five numbers that add
 * up to the lines: a line that only moved is "moved", not also "unchanged", and
 * a changed line that moved is "changed" (its own row says where it went).
 */
export function countsText(
  t: TFunction,
  differences: PoVersionDifferences,
): string {
  const { counts, lines, pricesCompared } = differences;
  const movedOnly = lines.filter(
    (line) => line.status === "unchanged" && line.moved,
  ).length;
  // `counts.unchanged` holds the moved-only lines too, so they come out of it.
  const unchanged = Math.max(0, counts.unchanged - movedOnly);
  return t(
    pricesCompared ? "order.versions.counts" : "order.versions.countsMasked",
    {
      added: counts.added,
      removed: counts.removed,
      changed: counts.changed,
      moved: movedOnly,
      unchanged,
    },
  );
}

/** True when the only difference is the order of the lines: same header, same items, same numbers. */
export function onlyMoved(differences: PoVersionDifferences): boolean {
  return (
    !differences.identical &&
    differences.header.every((field) => !field.changed) &&
    differences.lines.every((line) => line.status === "unchanged") &&
    differences.lines.some((line) => line.moved)
  );
}
