import { cn } from "@/lib/utils";
import { alignsEnd, type DataTableColumn } from "./types";

type Shape = Pick<DataTableColumn<unknown>, "kind" | "align" | "wrap">;

/**
 * Where the first column stays when a narrow screen scrolls the table
 * sideways: at the left edge, or just right of the row checkboxes.
 */
export type Sticky = "none" | "start" | "afterSelect";

const STICKY_LEFT: Record<Exclude<Sticky, "none">, string> = {
  start: "left-0",
  afterSelect: "left-11",
};

/** `true` is the first column of a table without checkboxes. */
function stickyOf(first: Sticky | boolean): Sticky {
  if (first === true) return "start";
  return first === false ? "none" : first;
}

/**
 * The look of one cell, shared by the real rows and the skeleton rows so that
 * a table does not jump when its data arrives. Dense: one line of text plus
 * 8 px above and below is a 36 px row. The first column stays in view when a
 * narrow screen scrolls the table sideways. A cell stays on one line unless its
 * column says `wrap`.
 */
export function cellClass(column: Shape, first: Sticky | boolean): string {
  const sticky = stickyOf(first);
  return cn(
    "px-3 py-2",
    alignsEnd(column) && "text-right tabular-nums",
    column.wrap ? "min-w-[26rem] whitespace-normal" : "whitespace-nowrap",
    sticky !== "none" &&
      cn(
        "sticky z-[1] bg-card group-hover/row:bg-muted group-data-[selected]/row:bg-accent max-md:border-r",
        STICKY_LEFT[sticky],
      ),
  );
}

/** A heading cell: the same sides as its column, and it stays at the top of the table's own scroll area. */
export function headClass(column: Shape, first: Sticky | boolean): string {
  const sticky = stickyOf(first);
  return cn(
    "sticky top-0 z-10 h-9 bg-card px-3 shadow-[inset_0_-1px_0_var(--border)]",
    alignsEnd(column) && "text-right",
    sticky !== "none" && cn("z-20 max-md:border-r", STICKY_LEFT[sticky]),
  );
}

/** The row checkbox column: 44 px wide, pinned to the left edge. */
export const SELECT_CELL =
  "sticky left-0 z-[1] w-11 min-w-11 bg-card px-0 py-0 text-center group-hover/row:bg-muted group-data-[selected]/row:bg-accent";

/** The row menu column: pinned to the right edge, so it is never scrolled away. */
export const ACTIONS_CELL =
  "sticky right-0 z-[1] w-px bg-card px-1 py-0 text-right group-hover/row:bg-muted group-data-[selected]/row:bg-accent max-md:border-l";
