import { useCallback, useMemo } from "react";
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
import { CheckColumnFilter } from "./CheckColumnFilter";
import { checkLabelOf } from "./checkLabels";
import { DiscrepancyCell } from "./DiscrepancyCell";

const URL_FILTERS = ["state", "rule"] as const;

/**
 * The rows already on screen, narrowed to one check type and put in order by
 * its order number or customer. This is the page's own rows only: the server
 * still decides which page of the queue it sends, so a match outside this
 * page is not pulled in and the total above the table still counts the
 * whole, unnarrowed queue.
 */
function visibleRows(
  rows: readonly CheckException[],
  rule: string | undefined,
  sort: { columnId: string; direction: "asc" | "desc" } | null,
): CheckException[] {
  const narrowed = rule
    ? rows.filter((row) => checkLabelOf(row.ruleLabel) === rule)
    : rows;
  if (!sort || (sort.columnId !== "order" && sort.columnId !== "customer")) {
    return [...narrowed];
  }
  const direction = sort.direction === "asc" ? 1 : -1;
  const key = (row: CheckException) =>
    sort.columnId === "order" ? row.orderNo : row.customerName;
  return [...narrowed].sort((a, b) => key(a).localeCompare(key(b)) * direction);
}

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
  const ruleFilter =
    typeof query.filters.rule === "string" ? query.filters.rule : undefined;
  const onSelectRule = useCallback(
    (next: string | undefined) => {
      const filters = { ...query.filters };
      if (next) {
        filters.rule = next;
      } else {
        delete filters.rule;
      }
      setQuery({ ...query, page: 1, filters });
    },
    [query, setQuery],
  );

  const columns = useMemo<DataTableColumn<CheckException>[]>(
    () => [
      {
        id: "order",
        header: t("list.columns.order"),
        cell: (row) => (
          <RecordLink
            to={`/order-tracker/${row.orderNo}`}
            className="-my-0.5 inline-block py-0.5 font-mono font-medium text-primary underline-offset-4 hover:underline"
          >
            {row.orderNo}
          </RecordLink>
        ),
        exportValue: (row) => row.orderNo,
        hideable: false,
        sortable: true,
      },
      {
        id: "customer",
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
        id: "rule",
        header: t("list.columns.rule"),
        headerContent: (
          <CheckColumnFilter value={ruleFilter} onSelect={onSelectRule} />
        ),
        cell: (row) => checkLabelOf(row.ruleLabel),
        exportValue: (row) => checkLabelOf(row.ruleLabel),
      },
      {
        id: "discrepancy",
        header: t("list.columns.discrepancy"),
        cell: (row) => (
          <DiscrepancyCell
            row={row}
            expectedLabel={t("list.columns.expected")}
            actualLabel={t("list.columns.actual")}
          />
        ),
        exportValue: (row) => `${row.summary} (${row.difference})`,
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
    [t, tc, ruleFilter, onSelectRule],
  );

  return (
    <div className="dx-sheet-wide dx-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<DemoBadge kind="mock" />}
        total={list.data?.meta.total}
      />
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
      <DataTable
        tableId="exceptions"
        caption={t("list.caption")}
        columns={columns}
        rows={visibleRows(list.data?.data ?? [], ruleFilter, query.sort)}
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
