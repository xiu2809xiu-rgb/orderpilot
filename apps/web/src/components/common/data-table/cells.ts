import { cn } from "@/lib/utils";
import { alignsEnd, type DataTableColumn } from "./types";

type Shape = Pick<DataTableColumn<unknown>, "kind" | "align" | "wrap">;

/**
 * The look of one cell, shared by the real rows and the skeleton rows so that
 * a table does not jump when its data arrives. Dense: one line of text plus
 * 8 px above and below is a 36 px row. The first column stays in view when a
 * narrow screen scrolls the table sideways. A cell stays on one line unless its
 * column says `wrap`.
 */
export function cellClass(column: Shape, first: boolean): string {
  return cn(
    "px-3 py-2",
    alignsEnd(column) && "text-right tabular-nums",
    column.wrap ? "min-w-56 whitespace-normal" : "whitespace-nowrap",
    first &&
      "sticky left-0 z-[1] bg-card group-hover/row:bg-muted max-md:border-r",
  );
}

/** A heading cell: the same sides as its column, and it stays at the top of the table's own scroll area. */
export function headClass(column: Shape, first: boolean): string {
  return cn(
    "sticky top-0 z-10 h-9 bg-card px-3 shadow-[inset_0_-1px_0_var(--border)]",
    alignsEnd(column) && "text-right",
    first && "left-0 z-20 max-md:border-r",
  );
}
