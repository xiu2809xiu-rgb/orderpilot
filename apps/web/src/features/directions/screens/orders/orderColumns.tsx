import type { TFunction } from "i18next";
import type { DataTableColumn } from "@/components/common";
import { formatDay } from "@/lib/format";
import { orderHref } from "../home/homeLinks";
import { FoldedFacts } from "./FoldedFacts";
import { foldedAt, type Fit } from "./orderFit";
import { OrderCell } from "./OrderCell";
import { AgeCell, DocsCell, StockCell, ValueCell } from "./OrderFigures";
import { ageInDays, ALL_DONE, type OrderRow } from "./orderRow";
import { StageCell } from "./StageCell";
import { shortSentence } from "./stockText";

interface ColumnContext {
  t: TFunction;
  /** Names a team: the tracker's owner role. */
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string;
  /** `YYYY-MM-DD`, in Singapore. */
  today: string;
  /** The role may not see amounts, so the value column cannot sort by them. */
  valueHidden: boolean;
  /**
   * The Waiting on stock filter is on, so the Stock column shows until the
   * viewer chooses their own columns: a list of orders that wait on stock
   * should say what each is short of.
   */
  showStock?: boolean;
  /** How much of the table the window fits; wide when not said. */
  fit?: Fit;
}

/**
 * The columns of the merged list, in one table. The record number leads and
 * cannot be hidden. Eight show by default: the order, the PO number, the
 * customer, the stage (with the age and, for a held order, why), the team
 * that holds it, the ship date, the value and the documents. The rest are
 * under Columns. Numbers and money sit on the right. The value cannot sort for
 * a role that may not see it: the order of hidden figures would give them away.
 */
export function orderColumns({
  t,
  roleLabel,
  today,
  valueHidden,
  showStock = false,
  fit = "dots",
}: ColumnContext): DataTableColumn<OrderRow>[] {
  const day = (value: string | null) =>
    value ? formatDay(value) : t("cells.notSet");
  const folded = foldedAt(fit);
  return [
    {
      id: "orderNo",
      header: t("columns.orderNo"),
      cell: (row) => (
        <OrderCell
          row={row}
          href={orderHref(row.orderNo)}
          facts={
            folded.length > 0 ? (
              <FoldedFacts row={row} ids={folded} roleLabel={roleLabel} />
            ) : null
          }
        />
      ),
      exportValue: (row) => row.orderNo,
      sortable: true,
      hideable: false,
    },
    {
      id: "externalDocumentNo",
      header: t("columns.po"),
      cell: (row) => <span className="numeral">{row.externalDocumentNo}</span>,
      exportValue: (row) => row.externalDocumentNo,
    },
    {
      id: "customerName",
      header: t("columns.customer"),
      cell: (row) => (
        <span className="od-customer">
          {/* The name is shortened to the column, so the full one is a tooltip. */}
          <span
            className="od-customer-name"
            title={row.customerName ?? row.customerNo}
          >
            {row.customerName ?? row.customerNo}
          </span>
          <span className="numeral od-customer-no">{row.customerNo}</span>
        </span>
      ),
      exportValue: (row) =>
        row.customerName
          ? `${row.customerNo} ${row.customerName}`
          : row.customerNo,
      sortable: true,
    },
    {
      id: "step",
      header: t("columns.stage"),
      cell: (row) => (
        <StageCell row={row} today={today} dots={fit === "dots"} />
      ),
      exportValue: (row) => row.status?.label ?? row.workflowStatus ?? "",
      sortable: true,
    },
    {
      id: "heldAt",
      header: t("columns.heldAt"),
      cell: (row) =>
        row.ownerRole === null ? (
          <span className="text-muted-foreground">-</span>
        ) : row.step === ALL_DONE ? (
          <span className="text-muted-foreground">{t("cells.done")}</span>
        ) : (
          // A long role name takes two lines rather than widen the column.
          <span className="od-held">{roleLabel(row.ownerRole)}</span>
        ),
      exportValue: (row) => (row.ownerRole ? roleLabel(row.ownerRole) : ""),
    },
    {
      id: "age",
      header: t("columns.age"),
      cell: (row) => <AgeCell row={row} today={today} />,
      exportValue: (row) =>
        row.overdue?.overdue
          ? `${String(ageInDays(row.orderDate, today))} (${row.overdue.reason ?? ""})`
          : String(ageInDays(row.orderDate, today)),
      kind: "number",
      // The stage cell shows the age; this column is for a person who wants it apart.
      defaultHidden: true,
    },
    {
      id: "shipmentDate",
      header: t("columns.shipDate"),
      cell: (row) => day(row.shipmentDate),
      exportValue: (row) => row.shipmentDate ?? "",
      sortable: true,
      kind: "date",
    },
    {
      id: "amount",
      header: t("columns.value"),
      cell: (row) => <ValueCell row={row} />,
      // A file carries the currency, which the screen shows beside each figure.
      exportValue: (row) =>
        row.amount.value === null
          ? t("cells.hidden")
          : `${row.currencyCode} ${row.amount.value}`,
      kind: "money",
      sortable: !valueHidden,
    },
    {
      id: "docs",
      header: t("columns.documents"),
      cell: (row) => <DocsCell row={row} />,
      exportValue: (row) =>
        [
          row.toConfirm ? t("cells.toConfirm") : "",
          // The words of the screen: the row carries a count, not the kind.
          row.openExceptions > 0
            ? t("cells.exceptions", { count: row.openExceptions })
            : "",
        ]
          .filter(Boolean)
          .join("; "),
    },
    {
      id: "stock",
      header: t("columns.stock"),
      cell: (row) => <StockCell row={row} />,
      exportValue: (row) => shortSentence(row, t),
      defaultHidden: !showStock,
    },
    {
      id: "orderDate",
      header: t("columns.orderDate"),
      cell: (row) => day(row.orderDate),
      exportValue: (row) => row.orderDate,
      sortable: true,
      kind: "date",
      defaultHidden: true,
    },
    {
      id: "entry",
      header: t("columns.entry"),
      cell: (row) =>
        row.captureState
          ? t(`entry.${row.captureState}`)
          : t("cells.notEntered"),
      exportValue: (row) =>
        row.captureState ? t(`entry.${row.captureState}`) : "",
      sortable: true,
      defaultHidden: true,
    },
    {
      id: "source",
      header: t("columns.source"),
      cell: (row) => t(`source.${row.source}`),
      exportValue: (row) => t(`source.${row.source}`),
      defaultHidden: true,
    },
  ];
}
