import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { VendorRow } from "@orderpilot/shared";
import {
  allPages,
  apiParams,
  RecordLink,
  useUrlQuery,
  type DataTableColumn,
} from "@/components/common";
import { ListPage } from "@/components/list-page";
import {
  masterDataVendors,
  useMasterDataVendors,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataVendorsParams } from "@/lib/api/generated/model";
import { readOnlyActions } from "./listActions";
import { MaskedMoney } from "./pieces";

const URL_FILTERS = {};
const SORTABLE = [
  "no",
  "name",
  "openPurchaseOrders",
  "itemsSupplied",
  "balanceLcy",
];

function vendorColumns(
  t: TFunction,
  balanceHidden: boolean,
): DataTableColumn<VendorRow>[] {
  return [
    {
      id: "no",
      header: t("vendors.columns.no"),
      cell: (row) => (
        <RecordLink
          to={`/master-data/vendors/${row.no}`}
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
      header: t("vendors.columns.name"),
      cell: (row) => row.name,
      exportValue: (row) => row.name,
      sortable: true,
    },
    {
      id: "currency",
      header: t("vendors.columns.currency"),
      cell: (row) => row.currencyCode,
      exportValue: (row) => row.currencyCode,
    },
    {
      id: "paymentTerms",
      header: t("vendors.columns.paymentTerms"),
      cell: (row) => row.paymentTermsCode,
      exportValue: (row) => row.paymentTermsCode,
    },
    {
      id: "openPurchaseOrders",
      header: t("vendors.columns.openPurchaseOrders"),
      cell: (row) => row.openPurchaseOrders,
      exportValue: (row) => row.openPurchaseOrders,
      kind: "number",
      sortable: true,
    },
    {
      id: "itemsSupplied",
      header: t("vendors.columns.itemsSupplied"),
      cell: (row) => row.itemsSupplied,
      exportValue: (row) => row.itemsSupplied,
      kind: "number",
      sortable: true,
    },
    {
      id: "balanceLcy",
      header: t("vendors.columns.balance"),
      cell: (row) => <MaskedMoney field={row.balanceLcy} />,
      exportValue: (row) => row.balanceLcy.value ?? t("table.hidden"),
      kind: "money",
      sortable: !balanceHidden,
    },
  ];
}

const ACTIONS = readOnlyActions<VendorRow>();

/** Every vendor. Read-only. Bank details are on a vendor's own page, masked by role. */
export default function VendorsPage() {
  const { t } = useTranslation("master-data");
  const [query, setQuery] = useUrlQuery(URL_FILTERS, { pageSize: 25 });
  const params: MasterDataVendorsParams = apiParams(query, SORTABLE);
  const list = useMasterDataVendors(params, {
    query: { placeholderData: (previous) => previous },
  });
  const balanceHidden = list.data?.data[0]?.balanceLcy.masked ?? false;
  const columns = useMemo(
    () => vendorColumns(t, balanceHidden),
    [t, balanceHidden],
  );

  return (
    <ListPage
      tableId="master-data-vendors"
      title={t("vendors.title")}
      description={t("vendors.description")}
      demo="mockBusinessCentral"
      caption={t("vendors.caption")}
      columns={columns}
      rowKey={(row) => row.no}
      rowHref={(row) => `/master-data/vendors/${row.no}`}
      query={query}
      onQueryChange={setQuery}
      list={list}
      actions={ACTIONS}
      exportOptions={{
        fileName: "vendors",
        loadRows: () =>
          allPages(async (page) =>
            masterDataVendors({ ...params, page, pageSize: 200 }),
          ),
      }}
      empty={{
        title: t("vendors.emptyTitle"),
        description: t("emptyDescription"),
      }}
    />
  );
}
