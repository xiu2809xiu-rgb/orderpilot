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
  amount: "6.5rem",
  availability: "minmax(7rem, 1.2fr)",
  remove: "2.75rem",
};

/** The `grid-template-columns` of the columns, for screens wide enough for a grid. */
export function trackTemplate(columns: readonly LineColumn[]): string {
  return columns.map((c) => c.width ?? DEFAULT_WIDTH[c.kind]).join(" ");
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
