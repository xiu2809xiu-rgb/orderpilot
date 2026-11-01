import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerRow } from "@orderpilot/shared";
import {
  DataTable,
  DemoBadge,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  RecordLink,
} from "@/components/common";
import {
  masterDataCustomers,
  useMasterDataCustomers,
  useMasterDataFilters,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataCustomersParams } from "@/lib/api/generated/model";
import { tableStatusOf } from "@/lib/query-status";
import { FilterSelect } from "./FilterSelect";
import { MasterDataTabs, countryName } from "./pieces";
import { allPages, apiParams, useUrlQuery } from "./useUrlQuery";

const FILTERS = { country: null, paymentTerms: null, priceGroup: null };
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
      id: "priceGroup",
      header: t("customers.columns.priceGroup"),
      cell: (row) => row.customerPriceGroup,
      exportValue: (row) => row.customerPriceGroup,
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
          <StatusBadge tone="danger">{row.overdueOrders}</StatusBadge>
        ) : (
          0
        ),
      exportValue: (row) => row.overdueOrders,
      kind: "number",
      sortable: true,
    },
  ];
}

/** Every customer, with what is open and overdue. Read-only. */
export default function CustomersPage() {
  const { t } = useTranslation("master-data");
  const [query, setQuery] = useUrlQuery(FILTERS);
  const params: MasterDataCustomersParams = apiParams(query, SORTABLE);
  const list = useMasterDataCustomers(params, {
    query: { placeholderData: (previous) => previous },
  });
  const options = useMasterDataFilters().data?.data;
  const columns = useMemo(() => customerColumns(t), [t]);
  const plain = (values: readonly string[] = []) =>
    values.map((value) => ({ value, label: value }));

  return (
    <div className="space-y-s3">
      <PageHeader
        title={t("customers.title")}
        description={t("customers.description")}
        meta={<DemoBadge kind="mockNavision" />}
        total={list.data?.meta.total}
      />
      <MasterDataTabs />
      <DataTable
        tableId="master-data-customers"
        caption={t("customers.caption")}
        columns={columns}
        rows={list.data?.data ?? []}
        total={list.data?.meta.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row.no}
        rowHref={(row) => `/master-data/customers/${row.no}`}
        status={tableStatusOf(list)}
        error={list.error}
        onRetry={() => void list.refetch()}
        exportOptions={{
          fileName: "customers",
          loadRows: () =>
            allPages(async (page) =>
              masterDataCustomers({ ...params, page, pageSize: 200 }),
            ),
        }}
        filterSlot={({ filters, setFilter }) => {
          const value = (id: string) => String(filters[id] ?? "");
          return (
            <>
              <FilterSelect
                label={t("customers.filters.country")}
                allLabel={t("customers.filters.allCountries")}
                value={value("country")}
                options={(options?.countries ?? []).map((code) => ({
                  value: code,
                  label: countryName(code),
                }))}
                onChange={(next) => {
                  setFilter("country", next);
                }}
              />
              <FilterSelect
                label={t("customers.filters.paymentTerms")}
                allLabel={t("customers.filters.allPaymentTerms")}
                value={value("paymentTerms")}
                options={plain(options?.paymentTerms)}
                onChange={(next) => {
                  setFilter("paymentTerms", next);
                }}
              />
              <FilterSelect
                label={t("customers.filters.priceGroup")}
                allLabel={t("customers.filters.allPriceGroups")}
                value={value("priceGroup")}
                options={plain(options?.priceGroups)}
                onChange={(next) => {
                  setFilter("priceGroup", next);
                }}
              />
            </>
          );
        }}
        empty={{
          title: t("customers.emptyTitle"),
          description: t("emptyDescription"),
        }}
      />
    </div>
  );
}
