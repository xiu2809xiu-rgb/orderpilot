import type { DraftOptions } from "@/components/form";
import type { ColumnKind, LineColumn, LineValue } from "./types";

let counter = 0;

/** A line's identity. Falls back where `crypto.randomUUID` is missing (plain HTTP). */
export function newLineId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `line-${Date.now().toString(36)}-${String(counter)}`;
}

/** A blank line, as Add line and Enter on the last cell make it. */
export function emptyLine(): LineValue {
  return {
    lineId: newLineId(),
    item: null,
    description: "",
    quantity: "",
    unitPrice: "",
    unit: "",
    availableStock: null,
  };
}

/**
 * The draft options a form with a lines grid passes to `useDraft`. Prices are
 * left out when the role may not see them (the API never sends one, so a value
 * there would be an accident), and so is the stock, which is only true when the
 * API said it. Rows are matched on `lineId`.
 */
export function lineDraftOptions(
  name: string,
  priceMasked: boolean,
): Pick<DraftOptions, "exclude" | "rowKey"> {
  return {
    rowKey: "lineId",
    exclude: [
      `${name}.*.availableStock`,
      `${name}.*.listPrice`,
      ...(priceMasked ? [`${name}.*.unitPrice`] : []),
    ],
  };
}

const DEFAULT_WIDTH: Record<ColumnKind, string> = {
  lineNo: "2.75rem",
  item: "minmax(0, 2fr)",
  description: "minmax(0, 2fr)",
  quantity: "5.5rem",
  unitPrice: "6.5rem",
  // One width for every row: a track that grew to each row's own amount would
  // push that row's other columns out of line with the rest. 9rem holds 17 characters.
  amount: "9rem",
  availability: "minmax(7rem, 1.2fr)",
  remove: "2.75rem",
};

// Between 640 and 768 px of the grid's own width (a tablet in landscape with
// the side menu open) the same columns fit in tighter tracks. Only the columns
// whose width is a default are tightened: a screen's own width is kept.
const COMPACT_WIDTH: Partial<Record<ColumnKind, string>> = {
  lineNo: "2.25rem",
  item: "minmax(0, 2fr)",
  description: "minmax(0, 1fr)",
  quantity: "5rem",
  unitPrice: "5.5rem",
  amount: "8rem",
  availability: "minmax(6.5rem, 1fr)",
};

/**
 * The `grid-template-columns` of the columns, for screens wide enough for a
 * grid. `compact` is the version for the narrower of the two grid widths.
 */
export function trackTemplate(
  columns: readonly LineColumn[],
  compact = false,
): string {
  return columns
    .map(
      (c) =>
        c.width ??
        (compact ? COMPACT_WIDTH[c.kind] : undefined) ??
        DEFAULT_WIDTH[c.kind],
    )
    .join(" ");
}

const ENTRY_KINDS: readonly ColumnKind[] = [
  "item",
  "description",
  "quantity",
  "unitPrice",
];

/** The columns a person types in, in order. Enter, and the end of a line, use it. */
export function editableKinds(
  columns: readonly LineColumn[],
  options: { priceMasked: boolean },
): ColumnKind[] {
  return columns
    .filter(
      (c) =>
        ENTRY_KINDS.includes(c.kind) &&
        c.readOnly !== true &&
        !(c.kind === "unitPrice" && options.priceMasked),
    )
    .map((c) => c.kind);
}
