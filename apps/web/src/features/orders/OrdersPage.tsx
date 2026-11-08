import {
  ORDER_CAPTURE_STATES,
  ORDER_SOURCES,
  type SalesOrderRow,
} from "@orderpilot/shared";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  allPages,
  apiParams,
  useUrlQuery,
  type TableQuery,
} from "@/components/common";
import { ListPage, type ListFilter } from "@/components/list-page";
import { useMasterDataCustomers } from "@/lib/api/generated/endpoints/master-data/master-data";
import {
  ordersList,
  useOrdersList,
} from "@/lib/api/generated/endpoints/orders/orders";
import type { OrdersListParams } from "@/lib/api/generated/model";
import { readOnlyActions } from "./listActions";
import { orderColumns, orderHref } from "./orderColumns";
import { SORTABLE, URL_FILTERS } from "./orderParams";

const ACTIONS = readOnlyActions<SalesOrderRow>();

/** A role that cannot see amounts cannot sort by them, whatever the address says. */
function withoutAmountSort(query: TableQuery, hidden: boolean): TableQuery {
  return hidden && query.sort?.columnId === "amount"
    ? { ...query, sort: null }
    : query;
}

/**
 * Every order, the samples and the ones entered here, with how far each has got
 * and what stock it waits on. Read-only: nothing is ordered from this list.
 */
export default function OrdersPage() {
  const { t } = useTranslation("orders");
  const [asked, setQuery] = useUrlQuery(URL_FILTERS, { pageSize: 25 });
  // The server ignores an amount sort for a role that cannot see amounts, so
  // the first request may carry it. Once a row says amounts are masked, the
  // page stops showing and sending it.
  const [amountHidden, setAmountHidden] = useState(false);
  const query = useMemo(
    () => withoutAmountSort(asked, amountHidden),
    [asked, amountHidden],
  );
  const params = apiParams(query, SORTABLE) as OrdersListParams;
  const list = useOrdersList(params, {
    query: { placeholderData: (previous) => previous },
  });
  const masked = list.data?.data[0]?.amount.masked;
  if (masked !== undefined && masked !== amountHidden) setAmountHidden(masked);
  const customers = useMasterDataCustomers({ pageSize: 200 }).data?.data;
  const columns = useMemo(
    () => orderColumns(t, amountHidden),
    [t, amountHidden],
  );
  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "customerNo",
        kind: "lookup",
        label: t("filters.customer"),
        allLabel: t("filters.allCustomers"),
        options: (customers ?? []).map((customer) => ({
          value: customer.no,
          label: `${customer.no} ${customer.name}`,
        })),
      },
      {
        id: "stock",
        label: t("filters.stock"),
        allLabel: t("filters.allStock"),
        options: [{ value: "waiting", label: t("filters.waiting") }],
      },
      {
        id: "captureState",
        label: t("filters.captureState"),
        allLabel: t("filters.allCaptureStates"),
        options: ORDER_CAPTURE_STATES.map((state) => ({
          value: state,
          label: t(`captureStates.${state}`),
        })),
      },
      {
        id: "source",
        label: t("filters.source"),
        allLabel: t("filters.allSources"),
        more: true,
        options: ORDER_SOURCES.map((source) => ({
          value: source,
          label: t(`sources.${source}`),
        })),
      },
      {
        id: "orderDate",
        kind: "range",
        label: t("filters.orderDate"),
        more: true,
      },
    ],
    [t, customers],
  );

  return (
    <ListPage
      tableId="orders"
      title={t("title")}
      description={`${t("description")} ${t("hint")}`}
      demo="synthetic"
      caption={t("caption")}
      columns={columns}
      rowKey={(row) => row.orderNo}
      rowHref={orderHref}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={ACTIONS}
      operationLog={{ entityType: "Order", entityId: (row) => row.orderNo }}
      exportOptions={{
        fileName: "orders",
        loadRows: () =>
          allPages(async (page) =>
            ordersList({ ...params, page, pageSize: 200 }),
          ),
      }}
      empty={{
        title: t("emptyTitle"),
        description: t("emptyDescription"),
      }}
    />
  );
}
