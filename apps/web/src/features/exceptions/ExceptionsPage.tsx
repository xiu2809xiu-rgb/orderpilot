import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Truck } from "lucide-react";
import type { CheckException } from "@orderpilot/shared";
import {
  RelativeTime,
  StatusBadge,
  useUrlQuery,
  type DataTableColumn,
  RecordLink,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useExceptionsList } from "@/lib/api/generated/endpoints/exceptions/exceptions";
import {
  ListPage,
  type ListAction,
  type ListFilter,
} from "@/components/list-page";

const URL_FILTERS = ["state"] as const;

const READ = [
  { id: "export", kind: "export", permission: "exceptions.read" },
  { id: "print", kind: "print", permission: "exceptions.read" },
] satisfies ListAction<CheckException>[];

/** The exceptions queue: failed checks waiting for a person, on mock data. Newest first. */
export default function ExceptionsPage() {
  const { t } = useTranslation("exceptions");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useUrlQuery(URL_FILTERS);
  // The queue is the work waiting, so with no state in the link it shows the
  // open ones, as the server does. The State filter asks for the others.
  const state =
    query.filters.state === "RESOLVED" || query.filters.state === "ALL"
      ? query.filters.state
      : "OPEN";
  const list = useExceptionsList(
    {
      page: query.page,
      pageSize: query.pageSize,
      state,
      ...(query.search ? { search: query.search } : {}),
    },
    { query: { placeholderData: (previous) => previous } },
  );

  const phone = useMediaQuery("(max-width: 767px)");
  const columns = useMemo<DataTableColumn<CheckException>[]>(
    () => [
      {
        id: "order",
        header: t("list.columns.order"),
        cell: (row) => (
          <>
            <RecordLink
              to={`/order-tracker/${row.orderNo}`}
              className="-my-0.5 inline-block py-0.5 font-mono font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.orderNo}
            </RecordLink>
            {/* On a phone only this column is in view, so it names the customer. */}
            {phone ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                {row.customerName}
              </span>
            ) : null}
          </>
        ),
        exportValue: (row) => row.orderNo,
        hideable: false,
      },
      {
        id: "customer",
        header: t("list.columns.customer"),
        cell: (row) => `${row.customerName} (${row.customerNo})`,
        exportValue: (row) => `${row.customerNo} ${row.customerName}`,
      },
      {
        id: "rule",
        header: t("list.columns.rule"),
        cell: (row) => row.ruleLabel,
        exportValue: (row) => row.ruleLabel,
      },
      {
        id: "summary",
        header: t("list.columns.summary"),
        cell: (row) => row.summary,
        wrap: true,
        exportValue: (row) => row.summary,
      },
      {
        id: "expected",
        header: t("list.columns.expected"),
        cell: (row) => <span className="font-mono">{row.expected}</span>,
        exportValue: (row) => row.expected,
        defaultHidden: true,
      },
      {
        id: "actual",
        header: t("list.columns.actual"),
        cell: (row) => <span className="font-mono">{row.actual}</span>,
        exportValue: (row) => row.actual,
        defaultHidden: true,
      },
      {
        id: "difference",
        header: t("list.columns.difference"),
        cell: (row) => <span className="font-mono">{row.difference}</span>,
        exportValue: (row) => row.difference,
      },
      {
        id: "tolerance",
        header: t("list.columns.tolerance"),
        cell: (row) => `${row.tolerance.value} (${row.tolerance.label})`,
        exportValue: (row) => row.tolerance.value,
        defaultHidden: true,
      },
      {
        id: "fixBy",
        header: t("list.columns.fixBy"),
        cell: (row) => tc(`roles.${row.fixBy}`),
        exportValue: (row) => tc(`roles.${row.fixBy}`),
      },
      {
        id: "state",
        header: t("list.columns.state"),
        cell: (row) => (
          <StatusBadge tone={row.state === "OPEN" ? "warning" : "success"}>
            {t(`list.state.${row.state}`)}
          </StatusBadge>
        ),
        exportValue: (row) => t(`list.state.${row.state}`),
      },
      {
        id: "opened",
        header: t("list.columns.opened"),
        cell: (row) => <RelativeTime value={row.openedAt} />,
        exportValue: (row) => row.openedAt,
      },
    ],
    [t, tc, phone],
  );

  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "state",
        label: t("list.columns.state"),
        // No value in the link means the open ones, as the server answers.
        allLabel: t("list.state.OPEN"),
        options: [
          { value: "RESOLVED", label: t("list.state.RESOLVED") },
          { value: "ALL", label: t("list.state.ALL") },
        ],
        describe: (value) => t(`list.state.${value}`, { defaultValue: value }),
      },
    ],
    [t],
  );

  return (
    <ListPage
      tableId="exceptions"
      title={t("title")}
      description={t("description")}
      demo="mock"
      caption={t("list.caption")}
      columns={columns}
      rowKey={(row) => row.id}
      rowLabel={(row) => row.orderNo}
      rowHref={(row) => `/order-tracker/${row.orderNo}`}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={READ}
      operationLog={{ entityType: "Exception", entityId: (row) => row.id }}
      empty={{
        title: t("list.emptyTitle"),
        description: t("list.emptyDescription"),
        action: (
          <Button asChild variant="outline">
            <Link to="/order-tracker">
              <Truck aria-hidden="true" />
              {t("list.emptyAction")}
            </Link>
          </Button>
        ),
      }}
    />
  );
}
