import {
  ITEM_AVAILABILITIES,
  ITEM_CATEGORY_CODES,
  type ItemRow,
} from "@orderpilot/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { allPages, apiParams, useUrlQuery } from "@/components/common";
import { ListPage, type ListFilter } from "@/components/list-page";
import {
  masterDataItems,
  useMasterDataFilters,
  useMasterDataItems,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataItemsParams } from "@/lib/api/generated/model";
import { ITEM_SORTABLE, itemColumns } from "./itemColumns";
import { readOnlyActions } from "./listActions";
import { MasterDataTabs } from "./pieces";

const URL_FILTERS = {
  brand: null,
  category: ITEM_CATEGORY_CODES,
  vendor: null,
  availability: ITEM_AVAILABILITIES,
};
const ACTIONS = readOnlyActions<ItemRow>();

/** Every item with its stock. Read-only, because Navision stays the system of record. */
export default function ItemsPage() {
  const { t } = useTranslation("master-data");
  const [query, setQuery] = useUrlQuery(URL_FILTERS, { pageSize: 25 });
  const params: MasterDataItemsParams = apiParams(query, ITEM_SORTABLE);
  const list = useMasterDataItems(params, {
    query: { placeholderData: (previous) => previous },
  });
  const options = useMasterDataFilters().data?.data;
  const priceHidden = list.data?.data[0]?.unitPrice.masked ?? false;
  const columns = useMemo(() => itemColumns(t, priceHidden), [t, priceHidden]);
  const filters = useMemo<ListFilter[]>(
    () => [
      {
        id: "brand",
        label: t("items.filters.brand"),
        allLabel: t("items.filters.allBrands"),
        options: (options?.brands ?? []).map((brand) => ({
          value: brand,
          label: brand,
        })),
      },
      {
        id: "category",
        label: t("items.filters.category"),
        allLabel: t("items.filters.allCategories"),
        options: ITEM_CATEGORY_CODES.map((code) => ({
          value: code,
          label: t(`categories.${code}`),
        })),
      },
      {
        id: "availability",
        label: t("items.filters.availability"),
        allLabel: t("items.filters.allAvailability"),
        options: ITEM_AVAILABILITIES.map((code) => ({
          value: code,
          label: t(`availability.${code}`),
        })),
      },
      {
        id: "vendor",
        label: t("items.filters.vendor"),
        allLabel: t("items.filters.allVendors"),
        more: true,
        options: (options?.vendors ?? []).map((vendor) => ({
          value: vendor.no,
          label: vendor.name,
        })),
      },
    ],
    [t, options],
  );

  return (
    <ListPage
      tableId="master-data-items"
      title={t("items.title")}
      description={t("items.description")}
      demo="mockNavision"
      tabs={<MasterDataTabs />}
      caption={t("items.caption")}
      columns={columns}
      rowKey={(row) => row.no}
      rowHref={(row) => `/master-data/items/${row.no}`}
      query={query}
      onQueryChange={setQuery}
      list={list}
      filters={filters}
      actions={ACTIONS}
      exportOptions={{
        fileName: "items",
        loadRows: () =>
          allPages(async (page) =>
            masterDataItems({ ...params, page, pageSize: 200 }),
          ),
      }}
      empty={{
        title: t("items.emptyTitle"),
        description: t("emptyDescription"),
      }}
    />
  );
}
