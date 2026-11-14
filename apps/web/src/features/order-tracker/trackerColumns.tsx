import type { TFunction } from "i18next";
import type { TrackerOrder } from "@orderpilot/shared";
import {
  StatusBadge,
  type DataTableColumn,
  RecordLink,
} from "@/components/common";
import { formatDay } from "@/lib/format";
import { docBadgesOf, DocsBadges } from "./DocsBadges";
import { StatusColumnFilter } from "./StatusColumnFilter";
import type { LifecycleStageTab } from "./trackerParams";

/** What the Status column's own header needs to show and run its filter menu. */
export interface StatusFilterState {
  value: LifecycleStageTab;
  status: string | undefined;
  onSelectStatus: (status: string | undefined) => void;
}

/**
 * The tracker's columns. Only the four the API can sort are sortable. The
 * status label is shown as area 2 reports it: no colour or branch depends on
 * the status code, so a new status needs no change here.
 */
export function trackerColumns(
  t: TFunction,
  roleLabel: (role: TrackerOrder["ownerRole"]) => string,
  statusFilter: StatusFilterState,
): DataTableColumn<TrackerOrder>[] {
  const day = (value: string | null) =>
    value ? formatDay(value) : t("list.noShipmentDate");
  return [
    {
      id: "orderNo",
      header: t("list.columns.orderNo"),
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <RecordLink
            to={`/order-tracker/${row.orderNo}`}
            className="-my-0.5 inline-block py-0.5 underline-offset-4 hover:underline"
          >
            {row.orderNo}
          </RecordLink>
          {row.openExceptions > 0 ? (
            <span
              aria-label={t("list.columns.exceptionsBadge", {
                count: row.openExceptions,
              })}
              className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 px-1 text-[10px] font-bold leading-none text-destructive"
            >
              {row.openExceptions}
            </span>
          ) : null}
        </span>
      ),
      exportValue: (row) => row.orderNo,
      sortable: true,
      hideable: false,
    },
    {
      id: "customerName",
      header: t("list.columns.customer"),
      cell: (row) => (
        <span>
          {row.customerName}{" "}
          <span className="text-xs text-muted-foreground">
            {row.customerNo}
          </span>
        </span>
      ),
      exportValue: (row) => `${row.customerNo} ${row.customerName}`,
      sortable: true,
    },
    {
      id: "externalDocumentNo",
      header: t("list.columns.externalDocumentNo"),
      cell: (row) => (
        <span className="tabular-nums">{row.externalDocumentNo}</span>
      ),
      exportValue: (row) => row.externalDocumentNo,
      defaultHidden: true,
    },
    {
      id: "status",
      header: t("list.columns.status"),
      headerContent: <StatusColumnFilter {...statusFilter} />,
      cell: (row) => <StatusBadge>{row.status.label}</StatusBadge>,
      exportValue: (row) => row.status.label,
    },
    {
      // A concept column: see DocsBadges.tsx for what it does and does not
      // represent.
      id: "docs",
      header: t("list.columns.docs"),
      cell: (row) => <DocsBadges row={row} />,
      exportValue: (row) =>
        docBadgesOf(row)
          .map(({ code, state }) => `${code}:${state}`)
          .join(" "),
    },
    {
      id: "owner",
      header: t("list.columns.owner"),
      cell: (row) => roleLabel(row.ownerRole),
      exportValue: (row) => roleLabel(row.ownerRole),
    },
    {
      id: "overdue",
      header: t("list.columns.overdue"),
      cell: (row) =>
        row.overdue.overdue ? (
          <StatusBadge tone="danger">
            {t("list.overdueDays", { count: row.overdue.daysOverdue })}
          </StatusBadge>
        ) : (
          <span className="text-muted-foreground">{t("list.onTime")}</span>
        ),
      exportValue: (row) =>
        row.overdue.overdue ? (row.overdue.reason ?? "") : "",
    },
    {
      id: "orderDate",
      header: t("list.columns.orderDate"),
      // Shown on request, so the shipment date fits a laptop screen; it is what
      // someone chasing an order needs, and Overdue already says how late.
      defaultHidden: true,
      cell: (row) => formatDay(row.orderDate),
      exportValue: (row) => row.orderDate,
      sortable: true,
      kind: "date",
    },
    {
      id: "shipmentDate",
      header: t("list.columns.shipmentDate"),
      cell: (row) => day(row.shipmentDate),
      exportValue: (row) => row.shipmentDate,
      sortable: true,
      kind: "date",
    },
  ];
}
