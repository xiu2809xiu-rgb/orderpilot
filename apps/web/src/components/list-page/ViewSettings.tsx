import type { DataTableColumn, TableQuery } from "@/components/common";
import { ColumnSettings } from "@/components/common/data-table/ColumnSettings";
import { SavedViews } from "@/components/common/data-table/SavedViews";
import type { TablePrefs } from "@/components/common/data-table/useTablePrefs";

interface ViewSettingsProps<Row> {
  /** Every column, in the viewer's order. */
  columns: readonly DataTableColumn<Row>[];
  visibleIds: ReadonlySet<string>;
  prefs: TablePrefs;
  query: TableQuery;
  change: (patch: Partial<TableQuery>) => void;
}

/**
 * Saved views and column settings, kept on this device for this viewer. A
 * view holds the search, filters and sort with the columns shown and their
 * order, and applying it brings all of them back.
 */
export function ViewSettings<Row>({
  columns,
  visibleIds,
  prefs,
  query,
  change,
}: ViewSettingsProps<Row>) {
  return (
    <>
      <SavedViews
        saved={prefs.saved}
        onApply={(view) => {
          change({
            search: view.search,
            filters: view.filters,
            sort: view.sort,
          });
          prefs.applyColumns(view);
        }}
        onSave={(name) => {
          prefs.saveView(name, query);
        }}
        onDelete={prefs.deleteView}
      />
      <ColumnSettings
        columns={columns}
        visible={visibleIds}
        onVisibleChange={(ids) => {
          prefs.setHidden(
            columns.filter((c) => !ids.includes(c.id)).map((c) => c.id),
          );
        }}
        onOrderChange={prefs.setOrder}
        onReset={prefs.resetColumns}
      />
    </>
  );
}
