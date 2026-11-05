import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TrackerOrder } from "@orderpilot/shared";
import { MAX_PAGE_SIZE, useUrlQuery } from "@/components/common";
import {
  ListPage,
  type ListAction,
  type ListFilter,
} from "@/components/list-page";
import {
  trackerList,
  useTrackerList,
} from "@/lib/api/generated/endpoints/tracker/tracker";
import {
  toParams,
  TRACKER_URL_FILTERS,
  TRACKER_URL_OPTIONS,
} from "./trackerParams";
import { trackerColumns } from "./trackerColumns";

const READ = [
  { id: "export", kind: "export", permission: "tracker.read" },
  { id: "print", kind: "print", permission: "tracker.read" },
] satisfies ListAction<TrackerOrder>[];

/** The order tracker: every order with its status, owner and overdue flag, on mock data. */
export default function OrderTrackerPage() {
  const { t } = useTranslation("order-tracker");
  const { t: tc } = useTranslation("common");
  const [query, setQuery] = useUrlQuery(
    TRACKER_URL_FILTERS,
    TRACKER_URL_OPTIONS,
  );
  const list = useTrackerList(toParams(query), {
    query: { placeholderData: (previous) => previous },
  });
  const columns = useMemo(
    () => trackerColumns(t, (role) => tc(`roles.${role}`)),
    [t, tc],
  );
  // A link can carry several status codes at once, so the select names them
  // all in words (`describe`) as well as offering one at a time.
  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "status",
        label: t("list.columns.status"),
        allLabel: t("list.allStatuses"),
        options: Object.keys(
          t("list.statuses", { returnObjects: true }) as object,
        ).map((code) => ({ value: code, label: t(`list.statuses.${code}`) })),
        describe: (value) =>
          value
            .split(",")
            .map((code) => t(`list.statuses.${code}`, { defaultValue: code }))
            .join(", "),
      },
      { id: "open", label: t("list.chips.open"), kind: "toggle" },
      { id: "overdue", label: t("list.overdueOnly"), kind: "toggle" },
      {
        id: "documentToConfirm",
        label: t("list.chips.documentToConfirm"),
        kind: "toggle",
        more: true,
      },
    ],
    [t],
  );

  return (
    <ListPage
      tableId="order-tracker"
      title={t("title")}
      description={t("description")}
      demo="mock"
      caption={t("list.caption")}
      columns={columns}
      rowKey={(row) => row.orderNo}
      rowHref={(row) => `/order-tracker/${row.orderNo}`}
      query={query}
      onQueryChange={setQuery}
      list={list}
      loadPage={(page) =>
        trackerList({ ...toParams(query), page, pageSize: MAX_PAGE_SIZE })
      }
      filters={filters}
      actions={READ}
      operationLog={{ entityType: "Order", entityId: (row) => row.orderNo }}
      empty={{
        title: t("list.emptyTitle"),
        description: t("list.emptyDescription"),
      }}
    />
  );
}
