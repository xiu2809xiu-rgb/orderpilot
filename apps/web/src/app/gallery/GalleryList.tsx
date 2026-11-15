import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StatusChip,
  STATUS_FAMILIES,
  type DataTableColumn,
  type StatusFamily,
  type TableQuery,
  DEFAULT_QUERY,
} from "@/components/common";
import {
  ListPage,
  type ListAction,
  type ListFilter,
  type ListResult,
} from "@/components/list-page";
import { toast } from "@/components/common/toast";
import { formatMoney } from "@/lib/format";
import {
  CUSTOMERS,
  DEMO_ORDERS,
  serveOrders,
  type DemoOrder,
  type DemoStatus,
} from "./galleryData";

const FAMILY: Record<DemoStatus, StatusFamily> = {
  draft: "draft",
  waiting: "waiting",
  released: "ready",
  blocked: "blocked",
};

/**
 * The list page template with a fake server: filters, the action bar, row
 * checkboxes with a batch action, a row menu with Edit, Copy and Void, saved
 * views and column settings, Void with its reason, Export and Print.
 */
export function GalleryList() {
  const { t } = useTranslation("gallery");
  const [query, setQuery] = useState<TableQuery>({
    ...DEFAULT_QUERY,
    pageSize: 10,
  });
  const { rows, total } = serveOrders(query);
  const list: ListResult<DemoOrder> = {
    data: { data: rows, meta: { total } },
    isPending: false,
    isError: false,
    error: null,
    refetch: () => undefined,
  };

  const columns = useMemo<DataTableColumn<DemoOrder>[]>(
    () => [
      {
        id: "reference",
        header: t("table.order"),
        cell: (row) => (
          <span className="font-semibold tabular-nums">{row.reference}</span>
        ),
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
          <StatusChip family={FAMILY[row.status]}>
            {t(`status.${row.status}`)}
          </StatusChip>
        ),
        exportValue: (row) => t(`status.${row.status}`),
      },
      {
        id: "total",
        header: t("table.total"),
        cell: (row) => formatMoney(row.total.toFixed(2)),
        exportValue: (row) => row.total,
        sortable: true,
        kind: "money",
      },
    ],
    [t],
  );

  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "status",
        label: t("table.status"),
        allLabel: t("list.allStatuses"),
        options: (Object.keys(FAMILY) as DemoStatus[]).map((status) => ({
          value: status,
          label: t(`status.${status}`),
        })),
      },
      {
        id: "customer",
        label: t("table.customer"),
        allLabel: t("list.allCustomers"),
        kind: "lookup",
        options: CUSTOMERS.map((name) => ({ value: name, label: name })),
      },
      {
        id: "updated",
        label: t("table.updated"),
        kind: "range",
        more: true,
      },
      {
        id: "active",
        label: t("table.activeOnly"),
        kind: "toggle",
        more: true,
      },
    ],
    [t],
  );

  const actions = useMemo<ListAction<DemoOrder>[]>(
    () => [
      {
        id: "edit",
        kind: "edit",
        label: t("list.edit"),
        permission: "orders.read",
        onRun: ([row]) => {
          toast.done(t("list.editDone", { reference: row?.reference }));
        },
      },
      {
        id: "copy",
        kind: "copy",
        label: t("list.copy"),
        permission: "orders.read",
        onRun: ([row]) => {
          toast.done(t("list.copyDone", { reference: row?.reference }));
        },
      },
      {
        id: "remind",
        kind: "batch",
        label: t("list.remind"),
        permission: "orders.read",
        enabledFor: (picked) =>
          picked.every((row) => row.status === "waiting")
            ? undefined
            : t("list.remindOnlyWaiting"),
        onRun: (picked) => {
          toast.done(t("list.remindDone", { count: picked.length }));
        },
      },
      {
        id: "void",
        kind: "void",
        label: t("list.void"),
        permission: "orders.read",
        reasoned: {
          title: t("list.voidTitle"),
          description: t("list.voidDescription"),
          confirmLabel: t("list.voidConfirm"),
          doneMessage: ([row]) =>
            t("list.voidDone", { reference: row?.reference }),
          run: () => Promise.resolve(),
        },
      },
      { id: "export", kind: "export", permission: "orders.read" },
      { id: "print", kind: "print", permission: "orders.read" },
    ],
    [t],
  );

  return (
    <div className="space-y-s2">
      <ul
        aria-label={t("list.families")}
        className="flex flex-wrap items-center gap-2"
      >
        {STATUS_FAMILIES.map((family) => (
          <li key={family}>
            <StatusChip family={family}>
              {t(`list.family.${family}`)}
            </StatusChip>
          </li>
        ))}
        <li>
          <StatusChip>{t("list.family.none")}</StatusChip>
        </li>
      </ul>
      <ListPage
        tableId="gallery-list"
        title={t("list.title")}
        demo="synthetic"
        headingLevel={2}
        caption={t("list.caption")}
        columns={columns}
        rowKey={(row) => row.id}
        query={query}
        onQueryChange={setQuery}
        list={list}
        filters={filters}
        actions={actions}
        rowLabel={(row) => row.reference}
        operationLog={{ entityType: "Order", entityId: (row) => row.reference }}
        exportOptions={{
          fileName: "orders",
          loadRows: () => Promise.resolve(DEMO_ORDERS),
        }}
      />
    </div>
  );
}
