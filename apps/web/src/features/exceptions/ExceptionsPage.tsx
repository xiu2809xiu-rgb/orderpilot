import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Truck } from "lucide-react";
import type { CheckException } from "@orderpilot/shared";
import {
  DataTable,
  DemoBadge,
  FilterChips,
  PageHeader,
  RelativeTime,
  StatusBadge,
  useUrlQuery,
  type DataTableColumn,
  RecordLink,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useExceptionsList } from "@/lib/api/generated/endpoints/exceptions/exceptions";
import { tableStatusOf } from "@/lib/query-status";
import { ClampedText } from "./ClampedText";

const URL_FILTERS = ["state"] as const;

/** The exceptions queue: failed checks waiting for a person, on mock data. Newest first. */
export default function ExceptionsPage() {
  const { t } = useTranslation("exceptions");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useUrlQuery(URL_FILTERS);
  // The queue is the work waiting, so with no state in the link it shows the
  // open ones, as the server does. Clearing the chip asks for every state.
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

  const columns = useMemo<DataTableColumn<CheckException>[]>(
    () => [
      {
        id: "order",
        header: t("list.columns.order"),
        cell: (row) => (
          <RecordLink
            to={`/order-tracker/${row.orderNo}`}
            className="-my-0.5 inline-block py-0.5 underline-offset-4 hover:underline"
          >
            {row.orderNo}
          </RecordLink>
        ),
        exportValue: (row) => row.orderNo,
        hideable: false,
      },
      {
        id: "summary",
        header: t("list.columns.summary"),
        // On a phone this cell moves under the order number, in a cell that
        // keeps one line, so it asks for its own line breaks and a width to wrap in.
        cell: (row) => (
          <span className="whitespace-normal max-md:inline-block max-md:min-w-52">
            {row.summary}
          </span>
        ),
        wrap: true,
        exportValue: (row) => row.summary,
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
        id: "customer",
        header: t("list.columns.customer"),
        cell: (row) => (
          <ClampedText className="max-w-56">
            {`${row.customerName} (${row.customerNo})`}
          </ClampedText>
        ),
        exportValue: (row) => `${row.customerNo} ${row.customerName}`,
        // Hidden at first so the columns that say what to do fit a laptop; the
        // order's own page names the customer.
        defaultHidden: true,
      },
      {
        id: "rule",
        header: t("list.columns.rule"),
        cell: (row) => (
          <ClampedText className="max-w-64">{row.ruleLabel}</ClampedText>
        ),
        exportValue: (row) => row.ruleLabel,
        // The summary already says which check failed, in the words of the case.
        defaultHidden: true,
      },
      {
        id: "expected",
        header: t("list.columns.expected"),
        cell: (row) => <span className="tabular-nums">{row.expected}</span>,
        exportValue: (row) => row.expected,
        defaultHidden: true,
      },
      {
        id: "actual",
        header: t("list.columns.actual"),
        cell: (row) => <span className="tabular-nums">{row.actual}</span>,
        exportValue: (row) => row.actual,
        defaultHidden: true,
      },
      {
        id: "difference",
        header: t("list.columns.difference"),
        cell: (row) => <span className="tabular-nums">{row.difference}</span>,
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
        id: "opened",
        header: t("list.columns.opened"),
        cell: (row) => <RelativeTime value={row.openedAt} />,
        exportValue: (row) => row.openedAt,
      },
    ],
    [t, tc],
  );

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<DemoBadge kind="mock" />}
        total={list.data?.meta.total}
      />
      <DataTable
        tableId="exceptions"
        applied={
          <FilterChips
            chips={
              state === "ALL"
                ? []
                : [{ id: "state", label: t(`list.state.${state}`) }]
            }
            filters={query.filters}
            onChange={(filters) => {
              setQuery({
                ...query,
                page: 1,
                filters:
                  "state" in filters ? filters : { ...filters, state: "ALL" },
              });
            }}
          />
        }
        caption={t("list.caption")}
        columns={columns}
        rows={list.data?.data ?? []}
        total={list.data?.meta.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row.id}
        rowHref={(row) => `/order-tracker/${row.orderNo}`}
        status={tableStatusOf(list)}
        error={list.error}
        onRetry={() => void list.refetch()}
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
    </div>
  );
}
