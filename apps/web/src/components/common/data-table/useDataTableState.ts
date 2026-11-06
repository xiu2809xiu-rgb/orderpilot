import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { arrangeColumns } from "./columnOrder";
import type { DataTableColumn, TableFilters, TableQuery } from "./types";
import { useTablePrefs } from "./useTablePrefs";

/**
 * What a table works out from its query and the viewer's column settings: the
 * columns on screen, in the viewer's order, and the changes a toolbar or a
 * header may ask for. Every change goes back to the first page. The server
 * does the real work.
 */
export function useDataTableState<Row>(
  tableId: string,
  columns: readonly DataTableColumn<Row>[],
  query: TableQuery,
  onQueryChange: (query: TableQuery) => void,
) {
  const { t } = useTranslation("components");
  const prefs = useTablePrefs(tableId);
  const [sortNote, setSortNote] = useState("");

  const visibleIds = useMemo(
    () =>
      new Set(
        prefs.hidden
          ? columns
              .filter((c) => !prefs.hidden?.includes(c.id))
              .map((c) => c.id)
          : columns.filter((c) => !c.defaultHidden).map((c) => c.id),
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

  const change = (patch: Partial<TableQuery>) => {
    onQueryChange({ ...query, page: 1, ...patch });
  };
  const setFilter = (id: string, value: string | boolean | undefined) => {
    const rest = Object.entries(query.filters).filter(([key]) => key !== id);
    const filters: TableFilters = Object.fromEntries(rest);
    if (value !== undefined && value !== false && value !== "") {
      filters[id] = value;
    }
    change({ filters });
  };

  function sortBy(columnId: string) {
    const current = query.sort?.columnId === columnId ? query.sort : null;
    const header = columns.find((c) => c.id === columnId)?.header ?? columnId;
    if (current?.direction === "desc") {
      setSortNote("");
      change({ sort: null });
      return;
    }
    const direction = current ? "desc" : "asc";
    setSortNote(
      t(direction === "asc" ? "table.sortedAsc" : "table.sortedDesc", {
        column: header,
      }),
    );
    change({ sort: { columnId, direction } });
  }

  return {
    prefs,
    visibleIds,
    /** Every column, in the viewer's order: what the column settings list. */
    arranged,
    shown,
    change,
    setFilter,
    sortBy,
    sortNote,
    filtered: query.search !== "" || Object.keys(query.filters).length > 0,
  };
}

export type DataTableState<Row> = ReturnType<typeof useDataTableState<Row>>;
