import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ListChecks } from "lucide-react";
import {
  DataTable,
  DemoBadge,
  FilterChips,
  PageHeader,
  useUrlTableQuery,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { tableStatusOf } from "@/lib/query-status";
import { toParams, trackerChips, TRACKER_URL_FILTERS } from "./trackerParams";
import { trackerColumns } from "./trackerColumns";

/** The order tracker: every order with its status, owner and overdue flag, on mock data. */
export default function OrderTrackerPage() {
  const { t } = useTranslation("order-tracker");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useUrlTableQuery(TRACKER_URL_FILTERS);
  const tracker = useTrackerList(toParams(query), {
    query: { placeholderData: (previous) => previous },
  });
  const columns = useMemo(
    () => trackerColumns(t, (role) => tc(`roles.${role}`)),
    [t, tc],
  );

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={<DemoBadge kind="mock" />}
        total={tracker.data?.meta.total}
      />
      <FilterChips
        chips={trackerChips(query.filters, t)}
        filters={query.filters}
        onChange={(filters) => {
          setQuery({ ...query, page: 1, filters });
        }}
      />
      <DataTable
        tableId="order-tracker"
        caption={t("list.caption")}
        columns={columns}
        rows={tracker.data?.data ?? []}
        total={tracker.data?.meta.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row.orderNo}
        rowHref={(row) => `/order-tracker/${row.orderNo}`}
        status={tableStatusOf(tracker)}
        error={tracker.error}
        onRetry={() => void tracker.refetch()}
        toggleFilters={[{ id: "overdue", label: t("list.overdueOnly") }]}
        empty={{
          title: t("list.emptyTitle"),
          description: t("list.emptyDescription"),
          action: (
            <Button asChild variant="outline">
              <Link to="/orders">
                <ListChecks aria-hidden="true" />
                {t("list.emptyAction")}
              </Link>
            </Button>
          ),
        }}
      />
    </div>
  );
}
