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
