import type { DataTableColumn } from "@/components/common";
import { useMediaQuery } from "@/lib/useMediaQuery";

/**
 * How much of the table fits the window, widest first. Each step leaves out
 * what the one before could still show, and the facts of a column that is left
 * out move under the order's number, so a narrow window loses no information.
 *
 * - `dots`: from 1440 px, the whole default view with the nine stage dots.
 * - `full`: from 1366 px, the same without the dots. The side panel takes 318
 *   px, so the table has 1048 px here and every default column fits it.
 * - `mid`: from 1100 px. Held at, ship date and value move under the number.
 * - `small`: from 820 px, a tablet. The PO number moves there too.
 * - `tiny`: under 820 px. The documents move there as well; below 768 px the
 *   table itself folds the customer and the stage under the number.
 *
 * The queries say "max-width", so a test run with no matchMedia gets `dots`.
 */
export type Fit = "dots" | "full" | "mid" | "small" | "tiny";

const NO_DOTS = "(max-width: 1439px)";
const MID = "(max-width: 1365px)";
const SMALL = "(max-width: 1099px)";
const TINY = "(max-width: 819px)";

export function useFit(): Fit {
  const noDots = useMediaQuery(NO_DOTS);
  const mid = useMediaQuery(MID);
  const small = useMediaQuery(SMALL);
  const tiny = useMediaQuery(TINY);
  if (tiny) return "tiny";
  if (small) return "small";
  if (mid) return "mid";
  return noDots ? "full" : "dots";
}

/** The columns left out at each fit, in the order their facts are written under the number. */
const FOLDED: Readonly<Record<Fit, readonly string[]>> = {
  dots: [],
  full: [],
  mid: ["heldAt", "shipmentDate", "amount"],
  small: ["externalDocumentNo", "heldAt", "shipmentDate", "amount"],
  tiny: ["externalDocumentNo", "heldAt", "shipmentDate", "amount", "docs"],
};

export const foldedAt = (fit: Fit): readonly string[] => FOLDED[fit];

/** The columns to draw: the viewer's choice, less what this window has no room for. */
export function fitColumns<Row>(
  columns: readonly DataTableColumn<Row>[],
  fit: Fit,
): DataTableColumn<Row>[] {
  const left = FOLDED[fit];
  return columns.filter((column) => !left.includes(column.id));
}
