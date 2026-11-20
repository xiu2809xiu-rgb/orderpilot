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
  type MaskReason,
} from "@/components/common";
import { ListPage } from "@/components/list-page";
import {
  masterDataVendors,
  useMasterDataVendors,
} from "@/lib/api/generated/endpoints/master-data/master-data";
import type { MasterDataVendorsParams } from "@/lib/api/generated/model";
import { readOnlyActions } from "./listActions";
import { MaskedColumnHeader } from "./MaskedColumnHeader";
import { paymentTermsLabel } from "./paymentTerms";
import { maskedColumnReason, MaskedMoney, QuietDash } from "./pieces";

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
  balanceReason: MaskReason | null,
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
      cell: (row) => paymentTermsLabel(t, row.paymentTermsCode),
      exportValue: (row) => paymentTermsLabel(t, row.paymentTermsCode),
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
      // No row shows a balance to this role: the header says why, once.
      headerContent: balanceReason ? (
        <MaskedColumnHeader
          label={t("vendors.columns.balance")}
          reason={balanceReason}
        />
      ) : undefined,
      cell: (row) =>
        balanceReason ? <QuietDash /> : <MaskedMoney field={row.balanceLcy} />,
      exportValue: (row) => row.balanceLcy.value ?? t("table.hidden"),
      kind: "money",
      sortable: balanceReason === null,
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
  const rows = list.data?.data;
  const balanceReason = useMemo(
    () => maskedColumnReason((rows ?? []).map((row) => row.balanceLcy)),
    [rows],
  );
  const columns = useMemo(
    () => vendorColumns(t, balanceReason),
    [t, balanceReason],
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
