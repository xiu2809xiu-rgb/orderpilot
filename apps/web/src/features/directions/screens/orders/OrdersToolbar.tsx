import type { DataTableColumn } from "@/components/common";
import { ColumnSettings } from "@/components/common/data-table/ColumnSettings";
import { ExportMenu } from "@/components/common/data-table/ExportMenu";
import { SavedViews } from "@/components/common/data-table/SavedViews";
import type { TablePrefs } from "@/components/common/data-table/useTablePrefs";
import { PrintButton } from "@/components/list-page/PrintButton";
import { useTranslation } from "react-i18next";
import { fromSavedView, toSavedQuery } from "./savedViews";
import type { OrderRow } from "./orderRow";
import type { OrdersQuery } from "./ordersQuery";

/**
 * What a person does with the list as a whole: save the filters as a view,
 * choose the columns, and take the rows away as a file or on paper. Export
 * and Print take the ticked rows when some are ticked and every row the
 * filters show otherwise.
 */
export function OrdersToolbar({
  query,
  columns,
  shown,
  visibleIds,
  prefs,
  rows,
  appliedWords,
  onApply,
}: {
  query: OrdersQuery;
  columns: readonly DataTableColumn<OrderRow>[];
  shown: readonly DataTableColumn<OrderRow>[];
  visibleIds: ReadonlySet<string>;
  prefs: TablePrefs;
  /** The rows to take away: the ticked ones, or every row in the view. */
  rows: readonly OrderRow[];
  appliedWords: readonly string[];
  onApply: (query: OrdersQuery) => void;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="od-toolbar">
      <SavedViews
        saved={prefs.saved}
        onApply={(view) => {
          onApply(fromSavedView(view));
          prefs.applyColumns(view);
        }}
        onSave={(name) => {
          prefs.saveView(name, toSavedQuery(query));
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
      <ExportMenu columns={shown} rows={rows} fileName="orders" />
      <PrintButton
        label={t("toolbar.print")}
        title={t("title")}
        filters={appliedWords}
        columns={shown}
        rows={rows}
      />
    </div>
  );
}
