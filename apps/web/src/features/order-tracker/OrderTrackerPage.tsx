import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ListChecks } from "lucide-react";
import {
  DataTable,
  DEFAULT_QUERY,
  DemoBadge,
  PageHeader,
  type TableQuery,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { tableStatusOf } from "@/lib/query-status";
import { toParams } from "./trackerParams";
import { trackerColumns } from "./trackerColumns";

/** The order tracker: every order with its status, owner and overdue flag, on mock data. */
export default function OrderTrackerPage() {
  const { t } = useTranslation("order-tracker");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useState<TableQuery>(DEFAULT_QUERY);
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
      <DataTable
        tableId="order-tracker"
        caption={t("list.caption")}
        columns={columns}
        rows={tracker.data?.data ?? []}
        total={tracker.data?.meta.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row.orderNo}
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
