import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DataTable,
  DEFAULT_QUERY,
  MaskedValue,
  RelativeTime,
  StatusBadge,
  type DataTableColumn,
  type TableQuery,
  type TableStatus,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import {
  DEMO_ORDERS,
  GALLERY_NOW,
  STATUS_TONE,
  serveOrders,
  type DemoOrder,
} from "./galleryData";

type Scenario =
  "data" | "loading" | "error" | "forbidden" | "empty" | "partial";
const SCENARIOS: Scenario[] = [
  "data",
  "loading",
  "error",
  "forbidden",
  "empty",
  "partial",
];

/** The data table against a fake server, with buttons that force each state. */
export function GalleryTable() {
  const { t } = useTranslation("gallery");
  const [query, setQuery] = useState<TableQuery>(DEFAULT_QUERY);
  const [scenario, setScenario] = useState<Scenario>("data");

  const columns = useMemo<DataTableColumn<DemoOrder>[]>(
    () => [
      {
        id: "reference",
        header: t("table.order"),
        cell: (row) => <span className="font-mono">{row.reference}</span>,
        exportValue: (row) => row.reference,
        sortable: true,
        hideable: false,
      },
      {
        id: "customer",
        header: t("table.customer"),
        cell: (row) => row.customer,
        exportValue: (row) => row.customer,
        sortable: true,
      },
      {
        id: "status",
        header: t("table.status"),
        cell: (row) => (
          <StatusBadge tone={STATUS_TONE[row.status]}>
            {t(`status.${row.status}`)}
          </StatusBadge>
        ),
        exportValue: (row) => t(`status.${row.status}`),
      },
      {
        id: "total",
        header: t("table.total"),
        cell: (row) => (
          <MaskedValue
            masked={row.status === "blocked"}
            reason="price"
            value={row.total.toFixed(2)}
          />
        ),
        exportValue: (row) => (row.status === "blocked" ? "" : row.total),
        sortable: true,
        align: "end",
      },
      {
        id: "updatedAt",
        header: t("table.updated"),
        cell: (row) => <RelativeTime value={row.updatedAt} now={GALLERY_NOW} />,
        exportValue: (row) => row.updatedAt,
        sortable: true,
      },
    ],
    [t],
  );

  const { rows, total } = serveOrders(query);
  const status: TableStatus =
    scenario === "loading"
      ? "loading"
      : scenario === "error"
        ? "error"
        : scenario === "forbidden"
          ? "forbidden"
          : "ready";

  return (
    <div className="space-y-s2">
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((name) => (
          <Button
            key={name}
            size="sm"
            variant={scenario === name ? "default" : "outline"}
            aria-pressed={scenario === name}
            onClick={() => {
              setScenario(name);
            }}
          >
            {t(`demo.${name}`)}
          </Button>
        ))}
      </div>
      <DataTable
        tableId="gallery-orders"
        caption={t("table.caption")}
        columns={columns}
        rows={scenario === "empty" ? [] : rows}
        total={scenario === "empty" ? 0 : total}
        query={scenario === "empty" ? DEFAULT_QUERY : query}
        onQueryChange={setQuery}
        rowKey={(row) => row.id}
        status={status}
        error={new ApiError("INTERNAL_ERROR", "demo", 500, "trace-demo-0001")}
        onRetry={() => {
          setScenario("data");
        }}
        partialNotice={scenario === "partial" ? t("table.partial") : undefined}
        toggleFilters={[{ id: "active", label: t("table.activeOnly") }]}
        empty={{
          title: t("table.emptyTitle"),
          description: t("table.emptyDescription"),
          action: <Button>{t("table.emptyAction")}</Button>,
        }}
        exportOptions={{
          fileName: "orders",
          loadRows: () => Promise.resolve(DEMO_ORDERS),
        }}
      />
    </div>
  );
}
