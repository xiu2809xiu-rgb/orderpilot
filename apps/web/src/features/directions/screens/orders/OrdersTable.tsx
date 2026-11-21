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
import { useMediaQuery } from "@/lib/useMediaQuery";
import { orderHref } from "../home/homeLinks";
import { foldedAt, type Fit } from "./orderFit";
import { OrderRowMenu } from "./OrderRowMenu";
import type { OrderRow } from "./orderRow";
import type { Sort, SortId } from "./ordersQuery";

/**
 * Widths in pixels, so the eight default columns fit the 1048 px of table that
 * a 1366 px window leaves beside the side panel, and no column is cut off. Each
 * width is the widest content of its column plus the cell's 12 px of padding
 * and a few pixels to spare, because text is a pixel or two wider in Chromium
 * on Linux than on Windows. The order cell holds a number entered here
 * ("SO-20261115-0012", 137 px), with its chips under it; the PO number
 * "PO-BD-4317" is 94 px; the documents cell holds the "1 open exception" chip
 * (138 px). A role name in the held-at cell may take two lines, and so may an
 * amount of six figures or more, its currency above it, and the stage's
 * words; the customer name is the one cell that truncates, and its full name
 * is its tooltip. A narrower window leaves columns out (`orderFit`), so the
 * table needs no sideways scroll; a wider one shares out what is left.
 */
const WIDTH: Readonly<Record<string, number>> = {
  select: 32,
  orderNo: 152,
  externalDocumentNo: 106,
  customerName: 104,
  step: 136,
  heldAt: 100,
  age: 92,
  shipmentDate: 96,
  amount: 116,
  docs: 146,
  stock: 132,
  orderDate: 100,
  entry: 96,
  source: 100,
  actions: 42,
};

/** With facts under the number the column is a little wider, so a PO number or a value does not wrap to a word a line. */
const ORDER_WITH_FACTS = 176;

/**
 * On a touch screen the checkbox and the row menu are 44 px buttons, and
 * orders.css drops their cells' padding and pins the order column 44 px from
 * the edge to match. Their columns must be that wide too, or the cells clip
 * the buttons and the pinned order cell slides over the customer cell; the
 * row menu's column also holds its share of the 1 px border before it. The
 * customer column gives up the difference, so the default columns still fit
 * 1440 px.
 */
const TOUCH = "(pointer: coarse)";
const TOUCH_WIDTH: Readonly<Record<string, number>> = {
  select: 44,
  customerName: 96,
  actions: 45,
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
  fit,
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
  fit: Fit;
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
  const touch = useMediaQuery(TOUCH);
  const widthOf = (id: string) =>
    id === "orderNo" && foldedAt(fit).length > 0
      ? ORDER_WITH_FACTS
      : ((touch ? TOUCH_WIDTH[id] : undefined) ?? WIDTH[id] ?? 120);
  const widths = ["select", ...columns.map((column) => column.id), "actions"];
  const total = widths.reduce((sum, id) => sum + widthOf(id), 0);
  return (
    <ScrollRegion label={t("table.region")} className="od-scroll">
      <Table
        className="od-table"
        aria-busy={status === "loading"}
        // The stage cell shows the age itself, unless the age has its own column.
        data-age-column={columns.some((c) => c.id === "age") || undefined}
        style={{ minWidth: total }}
      >
        <caption className="sr-only">{t("table.caption")}</caption>
        <colgroup>
          {widths.map((id) => (
            <col key={id} style={{ width: widthOf(id) }} />
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
