import type { DataTableColumn, TableQuery } from "@/components/common";
import { ColumnMenu } from "@/components/common/data-table/ColumnMenu";
import { SavedFilters } from "@/components/common/data-table/SavedFilters";
import type { useTablePrefs } from "@/components/common/data-table/useTablePrefs";

interface ViewSettingsProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  visibleIds: ReadonlySet<string>;
  prefs: ReturnType<typeof useTablePrefs>;
  query: TableQuery;
  change: (patch: Partial<TableQuery>) => void;
}

/** Saved filters and column settings: kept on this device, for this viewer. */
export function ViewSettings<Row>({
  columns,
  visibleIds,
  prefs,
  query,
  change,
}: ViewSettingsProps<Row>) {
  return (
    <>
      <SavedFilters
        saved={prefs.saved}
        onApply={(saved) => {
          change({
            search: saved.search,
            filters: saved.filters,
            sort: saved.sort,
          });
        }}
        onSave={(name) => {
          prefs.saveFilter(name, query);
        }}
        onDelete={prefs.deleteFilter}
      />
      <ColumnMenu
        columns={columns}
        visible={visibleIds}
        onChange={(ids) => {
          prefs.setHidden(
            columns.filter((c) => !ids.includes(c.id)).map((c) => c.id),
          );
        }}
        onReset={() => {
          prefs.setHidden([]);
        }}
      />
    </>
  );
}
