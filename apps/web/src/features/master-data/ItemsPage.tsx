import { ITEM_AVAILABILITIES, ITEM_CATEGORY_CODES } from "@orderpilot/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, DemoBadge, PageHeader } from "@/components/common";
import {
  masterDataItems,
  useMasterDataFilters,
  useMasterDataItems,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataItemsParams } from "@/lib/api/generated/model";
import { tableStatusOf } from "@/lib/query-status";
import { FilterSelect } from "./FilterSelect";
import { ITEM_SORTABLE, itemColumns } from "./itemColumns";
import { MasterDataTabs } from "./pieces";
import { allPages, apiParams, useUrlQuery } from "./useUrlQuery";

const FILTERS = {
  brand: null,
  category: ITEM_CATEGORY_CODES,
  vendor: null,
  availability: ITEM_AVAILABILITIES,
};

/** Every item with its stock. Read-only, because Navision stays the system of record. */
export default function ItemsPage() {
  const { t } = useTranslation("master-data");
  const [query, setQuery] = useUrlQuery(FILTERS);
  const params: MasterDataItemsParams = apiParams(query, ITEM_SORTABLE);
  const list = useMasterDataItems(params, {
    query: { placeholderData: (previous) => previous },
  });
  const options = useMasterDataFilters().data?.data;
  const priceHidden = list.data?.data[0]?.unitPrice.masked ?? false;
  const columns = useMemo(() => itemColumns(t, priceHidden), [t, priceHidden]);

  return (
    <div className="space-y-s3">
      <PageHeader
        title={t("items.title")}
        description={t("items.description")}
        meta={<DemoBadge kind="mockNavision" />}
        total={list.data?.meta.total}
      />
      <MasterDataTabs />
      <DataTable
        tableId="master-data-items"
        caption={t("items.caption")}
        columns={columns}
        rows={list.data?.data ?? []}
        total={list.data?.meta.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row.no}
        rowHref={(row) => `/master-data/items/${row.no}`}
        status={tableStatusOf(list)}
        error={list.error}
        onRetry={() => void list.refetch()}
        exportOptions={{
          fileName: "items",
          loadRows: () =>
            allPages(async (page) =>
              masterDataItems({ ...params, page, pageSize: 200 }),
            ),
        }}
        filterSlot={({ filters, setFilter }) => {
          const value = (id: string) => String(filters[id] ?? "");
          return (
            <>
              <FilterSelect
                label={t("items.filters.brand")}
                allLabel={t("items.filters.allBrands")}
                value={value("brand")}
                options={(options?.brands ?? []).map((brand) => ({
                  value: brand,
                  label: brand,
                }))}
                onChange={(next) => {
                  setFilter("brand", next);
                }}
              />
              <FilterSelect
                label={t("items.filters.category")}
                allLabel={t("items.filters.allCategories")}
                value={value("category")}
                options={ITEM_CATEGORY_CODES.map((code) => ({
                  value: code,
                  label: t(`categories.${code}`),
                }))}
                onChange={(next) => {
                  setFilter("category", next);
                }}
              />
              <FilterSelect
                label={t("items.filters.vendor")}
                allLabel={t("items.filters.allVendors")}
                value={value("vendor")}
                options={(options?.vendors ?? []).map((vendor) => ({
                  value: vendor.no,
                  label: vendor.name,
                }))}
                onChange={(next) => {
                  setFilter("vendor", next);
                }}
              />
              <FilterSelect
                label={t("items.filters.availability")}
                allLabel={t("items.filters.allAvailability")}
                value={value("availability")}
                options={ITEM_AVAILABILITIES.map((code) => ({
                  value: code,
                  label: t(`availability.${code}`),
                }))}
                onChange={(next) => {
                  setFilter("availability", next);
                }}
              />
            </>
          );
        }}
        empty={{
          title: t("items.emptyTitle"),
          description: t("emptyDescription"),
        }}
      />
    </div>
  );
}
