import { useMemo } from "react";
import type { DataTableColumn } from "@/components/common";
import { arrangeColumns } from "@/components/common/data-table/columnOrder";
import { useTablePrefs } from "@/components/common/data-table/useTablePrefs";

/** Not "orders": the old Orders page keeps its own column choices under that name. */
export const TABLE_ID = "orders-workspace";

/**
 * Which columns show and in what order, kept per viewer in this browser like
 * every table of the app. The columns' own `defaultHidden` and declared order
 * apply until the viewer changes them.
 */
export function useOrderColumns<Row>(columns: readonly DataTableColumn<Row>[]) {
  const prefs = useTablePrefs(TABLE_ID);
  const visibleIds = useMemo(
    () =>
      new Set(
        prefs.hidden
          ? columns
              .filter((column) => !prefs.hidden?.includes(column.id))
              .map((column) => column.id)
          : columns.filter((column) => !column.defaultHidden).map((c) => c.id),
      ),
    [columns, prefs.hidden],
  );
  const arranged = useMemo(
    () => arrangeColumns(columns, prefs.order),
    [columns, prefs.order],
  );
  const shown = arranged.filter(
    (column) => column.hideable === false || visibleIds.has(column.id),
  );
  return { prefs, visibleIds, arranged, shown };
}
