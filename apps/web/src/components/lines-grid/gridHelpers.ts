import type { ColumnKind } from "./types";

// Whole class names for Tailwind. Numbers line up on the right, as their cells do.
export function headerClass(kind: ColumnKind): string | undefined {
  if (kind === "remove") return "sr-only";
  const numeric =
    kind === "quantity" || kind === "unitPrice" || kind === "amount";
  if (kind === "availability") return "@lines:pl-2";
  return numeric ? "@lines:text-right" : undefined;
}

/** Where Enter on an item goes: the quantity, since the pick filled the description. */
export function afterItem(editable: readonly string[]): string | undefined {
  return editable.find((kind) => kind !== "item" && kind !== "description");
}
