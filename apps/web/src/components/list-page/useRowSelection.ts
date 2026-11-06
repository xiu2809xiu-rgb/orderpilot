import { useCallback, useMemo, useState } from "react";
import type { TableSelection } from "@/components/common";

/**
 * The ticked rows of the page on screen. A tick is kept by the row's key, so
 * a refetch keeps it, and a row that leaves the page leaves the selection.
 * The list clears it whenever the query changes: selecting is for this page.
 */
export function useRowSelection<Row>(
  rows: readonly Row[],
  rowKey: (row: Row) => string,
  rowLabel: (row: Row) => string,
) {
  const [keys, setKeys] = useState<ReadonlySet<string>>(() => new Set());
  const selected = useMemo(
    () => rows.filter((row) => keys.has(rowKey(row))),
    [rows, keys, rowKey],
  );
  const clear = useCallback(() => {
    setKeys((current) => (current.size === 0 ? current : new Set()));
  }, []);

  const table: TableSelection<Row> = {
    isSelected: (row) => keys.has(rowKey(row)),
    onToggle: (row) => {
      const key = rowKey(row);
      setKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    onTogglePage: () => {
      setKeys(
        selected.length === rows.length && rows.length > 0
          ? new Set()
          : new Set(rows.map(rowKey)),
      );
    },
    pageState:
      selected.length === 0
        ? "none"
        : selected.length === rows.length
          ? "all"
          : "some",
    rowLabel,
  };
  return { selected, clear, table };
}
