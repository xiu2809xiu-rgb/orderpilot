import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerRow } from "@orderpilot/shared";
import {
  allPages,
  apiParams,
  RecordLink,
  StatusChip,
  useUrlQuery,
  type DataTableColumn,
} from "@/components/common";
import { ListPage, type ListFilter } from "@/components/list-page";
import {
  masterDataCustomers,
  useMasterDataCustomers,
  useMasterDataFilters,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataCustomersParams } from "@/lib/api/generated/model";
import { readOnlyActions } from "./listActions";
import { countryName } from "./pieces";

const URL_FILTERS = { country: null, paymentTerms: null };
const SORTABLE = ["no", "name", "openOrders", "overdueOrders"];

function customerColumns(t: TFunction): DataTableColumn<CustomerRow>[] {
  return [
    {
      id: "no",
      header: t("customers.columns.no"),
      cell: (row) => (
        <RecordLink
          to={`/master-data/customers/${row.no}`}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.no}
        </RecordLink>
      ),
      exportValue: (row) => row.no,
      sortable: true,
      hideable: false,
    },
    {
      id: "name",
      header: t("customers.columns.name"),
      cell: (row) => row.name,
      exportValue: (row) => row.name,
      sortable: true,
    },
    {
      id: "country",
      header: t("customers.columns.country"),
      cell: (row) => countryName(row.countryRegionCode),
      exportValue: (row) => countryName(row.countryRegionCode),
    },
    {
      id: "currency",
      header: t("customers.columns.currency"),
      cell: (row) => row.currencyCode,
      exportValue: (row) => row.currencyCode,
    },
    {
      id: "paymentTerms",
      header: t("customers.columns.paymentTerms"),
      cell: (row) => row.paymentTermsCode,
      exportValue: (row) => row.paymentTermsCode,
    },
    {
      id: "openOrders",
      header: t("customers.columns.openOrders"),
      cell: (row) => row.openOrders,
      exportValue: (row) => row.openOrders,
      kind: "number",
      sortable: true,
    },
    {
      id: "overdueOrders",
      header: t("customers.columns.overdue"),
      cell: (row) =>
        row.overdueOrders > 0 ? (
          <StatusChip family="blocked">
            {t("customers.overdueCount", { count: row.overdueOrders })}
          </StatusChip>
        ) : (
          0
        ),
      exportValue: (row) => row.overdueOrders,
      kind: "number",
      sortable: true,
    },
  ];
}

const ACTIONS = readOnlyActions<CustomerRow>();

/** Every customer, with what is open and overdue. Read-only. */
export default function CustomersPage() {
  const { t } = useTranslation("master-data");
  const [query, setQuery] = useUrlQuery(URL_FILTERS, { pageSize: 25 });
  const params: MasterDataCustomersParams = apiParams(query, SORTABLE);
  const list = useMasterDataCustomers(params, {
    query: { placeholderData: (previous) => previous },
  });
  const options = useMasterDataFilters().data?.data;
  const columns = useMemo(() => customerColumns(t), [t]);
  const filters = useMemo<ListFilter[]>(() => {
    const plain = (values: readonly string[] = []) =>
      values.map((value) => ({ value, label: value }));
    return [
      {
        id: "country",
        label: t("customers.filters.country"),
        allLabel: t("customers.filters.allCountries"),
        options: (options?.countries ?? []).map((code) => ({
          value: code,
          label: countryName(code),
        })),
      },
      {
        id: "paymentTerms",
        label: t("customers.filters.paymentTerms"),
        allLabel: t("customers.filters.allPaymentTerms"),
        options: plain(options?.paymentTerms),
      },
    ];
  }, [t, options]);

  return (
    <ListPage
      tableId="master-data-customers"
      title={t("customers.title")}
      description={t("customers.description")}
      demo="mockBusinessCentral"
      caption={t("customers.caption")}
      columns={columns}
      rowKey={(row) => row.no}
      rowHref={(row) => `/master-data/customers/${row.no}`}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={ACTIONS}
      exportOptions={{
        fileName: "customers",
        loadRows: () =>
          allPages(async (page) =>
            masterDataCustomers({ ...params, page, pageSize: 200 }),
          ),
      }}
      empty={{
        title: t("customers.emptyTitle"),
        description: t("emptyDescription"),
      }}
    />
  );
}
