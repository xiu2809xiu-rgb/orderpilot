import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useGrid } from "./gridContext";
import { AmountCell, AvailabilityCell } from "./LineDerivedCells";
import { LineNumberCell, RemoveCell } from "./LineChrome";
import {
  DescriptionCell,
  ItemCell,
  PriceCell,
  QuantityCell,
} from "./LineEntryCells";
import type { LineColumn } from "./types";

// Whole class names, so that Tailwind finds them. Stacked lines use two
// columns: short cells share a row, long ones take both.
const SPAN: Record<LineColumn["kind"], string> = {
  lineNo: "col-span-2 @3xl:col-span-1",
  item: "col-span-2 @3xl:col-span-1",
  description: "col-span-2 @3xl:col-span-1",
  quantity: "col-span-1",
  unitPrice: "col-span-1",
  amount: "col-span-1",
  availability: "col-span-2 @3xl:col-span-1",
  remove: "col-span-2 @3xl:col-span-1",
};

// On a phone a line is a block of its own, so its inputs get the touch height
// that a coarse pointer gets anywhere.
const STACKED_INPUTS = "@max-3xl:[&_input]:h-11";

function CellBody({ column, index }: { column: LineColumn; index: number }) {
  const grid = useGrid();
  const row = `${grid.name}.${String(index)}`;
  const readOnly = grid.readOnly || column.readOnly === true;
  const props = { index, row, readOnly };
  switch (column.kind) {
    case "lineNo":
      return <LineNumberCell index={index} row={row} />;
    case "item":
      return <ItemCell {...props} />;
    case "description":
      return <DescriptionCell {...props} />;
    case "quantity":
      return <QuantityCell {...props} />;
    case "unitPrice":
      return <PriceCell {...props} />;
    case "amount":
      return <AmountCell row={row} />;
    case "availability":
      return <AvailabilityCell index={index} row={row} />;
    case "remove":
      return grid.readOnly ? null : <RemoveCell index={index} />;
  }
}

/**
 * One line. It re-renders only when its position changes, since each cell
 * watches its own values: typing in line 80 leaves the other 199 alone.
 */
export const LineRow = memo(function LineRow({ index }: { index: number }) {
  const { t } = useTranslation("linesGrid");
  const grid = useGrid();
  return (
    <div
      role="row"
      data-row={index}
      tabIndex={grid.readOnly ? undefined : -1}
      aria-label={t("row", { n: index + 1 })}
      className={cn(
        "grid grid-cols-2 gap-x-s2 gap-y-s1 rounded-md border bg-card p-s2 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "@3xl:grid-cols-(--line-tracks) @3xl:items-start @3xl:gap-x-s1 @3xl:rounded-none @3xl:border-0 @3xl:border-b @3xl:bg-transparent @3xl:px-0 @3xl:py-1",
      )}
    >
      {grid.columns.map((column) => (
        <div
          key={column.kind}
          role="cell"
          data-cell={column.kind}
          className={cn("min-w-0", SPAN[column.kind], STACKED_INPUTS)}
        >
          {column.kind === "lineNo" || column.kind === "remove" ? null : (
            <span
              aria-hidden="true"
              className="mb-0.5 block text-xs text-muted-foreground @3xl:hidden"
            >
              {column.header}
            </span>
          )}
          <CellBody column={column} index={index} />
        </div>
      ))}
    </div>
  );
});
