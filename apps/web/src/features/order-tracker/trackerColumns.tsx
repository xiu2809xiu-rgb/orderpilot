import type { TFunction } from "i18next";
import { Link } from "react-router";
import type { TrackerOrder } from "@orderpilot/shared";
import { StatusBadge, type DataTableColumn } from "@/components/common";
import { formatDay } from "@/lib/format";

/**
 * The tracker's columns. Only the four the API can sort are sortable. The
 * status label is shown as area 2 reports it: no colour or branch depends on
 * the status code, so a new status needs no change here.
 */
export function trackerColumns(
  t: TFunction,
  roleLabel: (role: TrackerOrder["ownerRole"]) => string,
): DataTableColumn<TrackerOrder>[] {
  const day = (value: string | null) =>
    value ? formatDay(value) : t("list.noShipmentDate");
  return [
    {
      id: "orderNo",
      header: t("list.columns.orderNo"),
      cell: (row) => (
        <Link
          to={`/order-tracker/${row.orderNo}`}
          className="inline-block py-0.5 font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.orderNo}
        </Link>
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
          <span className="font-mono text-xs text-muted-foreground">
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
        <span className="font-mono">{row.externalDocumentNo}</span>
      ),
      exportValue: (row) => row.externalDocumentNo,
      defaultHidden: true,
    },
    {
      id: "status",
      header: t("list.columns.status"),
      cell: (row) => <StatusBadge>{row.status.label}</StatusBadge>,
      exportValue: (row) => row.status.label,
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
      id: "openExceptions",
      header: t("list.columns.exceptions"),
      cell: (row) => row.openExceptions,
      exportValue: (row) => row.openExceptions,
      kind: "number",
    },
    {
      id: "orderDate",
      header: t("list.columns.orderDate"),
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
