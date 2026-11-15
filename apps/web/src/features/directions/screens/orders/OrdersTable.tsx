import { useTranslation } from "react-i18next";
import type {
  DataTableColumn,
  TableSelection,
  TableSort,
} from "@/components/common";
import { ScrollRegion } from "@/components/common";
import { DataTableBody } from "@/components/common/data-table/DataTableBody";
import type { TableStatus } from "@/components/common/data-table/DataTableBody";
import { DataTableHead } from "@/components/common/data-table/DataTableHead";
import { Table } from "@/components/ui/table";
import { orderHref } from "../home/homeLinks";
import { OrderRowMenu } from "./OrderRowMenu";
import type { OrderRow } from "./orderRow";
import type { Sort, SortId } from "./ordersQuery";

/**
 * Widths in pixels, so the default columns fit one 1440 px screen with the side
 * panel open (1122 px of table) and no column is cut off. Each width is the
 * widest content of its column plus the cell's 16 px of padding and a few
 * pixels to spare, because text is a pixel or two wider in Chromium on Linux
 * than on Windows. The order cell holds a number entered here
 * ("SO-20261115-0012", 137 px), with its chips under it; the age cell "47 d"
 * over a "10 d late" chip (77 px); the documents cell a "To confirm" chip
 * (105 px). A role name in the held-at cell may take two lines, and so may an
 * amount of six figures or more, its currency above it; the customer name is
 * the one cell that truncates. A narrower screen scrolls the table inside its
 * own box; a wider one shares out what is left.
 */
const WIDTH: Readonly<Record<string, number>> = {
  select: 32,
  orderNo: 164,
  customerName: 134,
  step: 176,
  heldAt: 128,
  age: 96,
  shipmentDate: 104,
  amount: 120,
  docs: 124,
  stock: 132,
  externalDocumentNo: 116,
  orderDate: 100,
  entry: 96,
  source: 100,
  actions: 42,
};

/**
 * The one table. It is the app's own table head and body: its states (loading
 * rows that do not pulse, the error with its trace id and Retry, nothing
 * found with a way back), its sticky heading and its row checkboxes. A click
 * on a row opens the side peek; the number in the first column is the link
 * that opens the order. Nothing in it animates while it is in use.
 */
export function OrdersTable({
  columns,
  rows,
  status,
  error,
  filtered,
  sort,
  selection,
  peeked,
  onSort,
  onPeek,
  onRetry,
  onClearFilters,
}: {
  columns: readonly DataTableColumn<OrderRow>[];
  rows: readonly OrderRow[];
  status: TableStatus;
  error: unknown;
  filtered: boolean;
  sort: Sort | null;
  selection: TableSelection<OrderRow>;
  peeked: string | null;
  onSort: (id: SortId) => void;
  onPeek: (orderNo: string) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}) {
  const { t } = useTranslation("directions-orders");
  const tableSort: TableSort | null = sort
    ? { columnId: sort.id, direction: sort.direction }
    : null;
  const widths = ["select", ...columns.map((column) => column.id), "actions"];
  const total = widths.reduce((sum, id) => sum + (WIDTH[id] ?? 120), 0);
  return (
    <ScrollRegion label={t("table.region")} className="od-scroll">
      <Table
        className="od-table"
        aria-busy={status === "loading"}
        style={{ minWidth: total }}
      >
        <caption className="sr-only">{t("table.caption")}</caption>
        <colgroup>
          {widths.map((id) => (
            <col key={id} style={{ width: WIDTH[id] ?? 120 }} />
          ))}
        </colgroup>
        <DataTableHead
          columns={columns}
          sort={tableSort}
          onSort={(id) => {
            onSort(id as SortId);
          }}
          selection={selection}
          rowActions={{ header: t("table.actions"), cell: () => null }}
        />
        <DataTableBody
          columns={columns}
          rows={rows}
          rowKey={(row) => row.orderNo}
          status={status}
          pageSize={25}
          error={error}
          onRetry={onRetry}
          empty={{
            title: t("empty.title"),
            description: t("empty.description"),
          }}
          filtered={filtered}
          onClearFilters={onClearFilters}
          selection={selection}
          onRowClick={(row) => {
            onPeek(row.orderNo);
          }}
          rowActions={{
            header: t("table.actions"),
            cell: (row) => (
              <OrderRowMenu
                orderNo={row.orderNo}
                href={orderHref(row.orderNo)}
                onPeek={() => {
                  onPeek(row.orderNo);
                }}
              />
            ),
          }}
        />
      </Table>
      <span className="sr-only" aria-live="polite">
        {peeked ? t("table.peeking", { order: peeked }) : ""}
      </span>
    </ScrollRegion>
  );
}
