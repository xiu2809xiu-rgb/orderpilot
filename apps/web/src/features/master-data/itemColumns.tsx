import type { TFunction } from "i18next";
import type { ItemRow } from "@orderpilot/shared";
import type { DataTableColumn } from "@/components/common";
import { formatQuantity } from "@/lib/format";
import { AvailabilityBadge, MaskedMoney } from "./pieces";
import { RecordLink } from "@/components/common";

export const ITEM_SORTABLE = [
  "no",
  "description",
  "brand",
  "inventory",
  "qtyOnSalesOrder",
  "qtyOnPurchOrder",
  "availableStock",
  "unitPrice",
] as const;

const quantity = (
  id: "inventory" | "qtyOnSalesOrder" | "qtyOnPurchOrder",
  header: string,
): DataTableColumn<ItemRow> => ({
  id,
  header,
  cell: (row) => formatQuantity(row[id]),
  exportValue: (row) => Number(row[id]),
  kind: "number",
  sortable: true,
});

/** The price column cannot sort for a role that cannot see prices: the server refuses that too. */
export function itemColumns(
  t: TFunction,
  priceHidden: boolean,
): DataTableColumn<ItemRow>[] {
  return [
    {
      id: "no",
      header: t("items.columns.no"),
      cell: (row) => (
        <RecordLink
          to={`/master-data/items/${row.no}`}
          className="underline-offset-4 hover:underline"
        >
          {row.no}
        </RecordLink>
      ),
      exportValue: (row) => row.no,
      sortable: true,
      hideable: false,
    },
    {
      id: "description",
      header: t("items.columns.description"),
      // Capped so that the list fits a laptop screen; the full text is
      // on the item's page and in the export.
      cell: (row) => (
        <span className="block max-w-40 truncate" title={row.description}>
          {row.description}
        </span>
      ),
      exportValue: (row) => row.description,
      sortable: true,
    },
    {
      id: "partNumber",
      header: t("items.columns.partNumber"),
      cell: (row) => <span className="font-mono">{row.partNumber}</span>,
      exportValue: (row) => row.partNumber,
    },
    {
      id: "brand",
      header: t("items.columns.brand"),
      cell: (row) => row.brand,
      exportValue: (row) => row.brand,
      sortable: true,
      // The description starts with the brand, and the brand filter says it too.
      defaultHidden: true,
    },
    {
      id: "category",
      header: t("items.columns.category"),
      cell: (row) => t(`categories.${row.category}`),
      exportValue: (row) => t(`categories.${row.category}`),
      // The category filter already says it; Columns brings it back.
      defaultHidden: true,
    },
    quantity("inventory", t("items.columns.inventory")),
    quantity("qtyOnSalesOrder", t("items.columns.qtyOnSalesOrder")),
    quantity("qtyOnPurchOrder", t("items.columns.qtyOnPurchOrder")),
    {
      id: "availableStock",
      header: t("items.columns.availableStock"),
      cell: (row) => formatQuantity(row.availableStock),
      exportValue: (row) => Number(row.availableStock),
      kind: "number",
      sortable: true,
    },
    {
      id: "availability",
      header: t("items.columns.availability"),
      cell: (row) => <AvailabilityBadge availability={row.availability} />,
      exportValue: (row) => t(`availability.${row.availability}`),
    },
    {
      id: "unitPrice",
      header: t("items.columns.unitPrice"),
      cell: (row) => <MaskedMoney field={row.unitPrice} />,
      exportValue: (row) => row.unitPrice.value ?? t("table.hidden"),
      kind: "money",
      sortable: !priceHidden,
    },
    {
      id: "vendor",
      header: t("items.columns.vendor"),
      cell: (row) => (
        <RecordLink
          to={`/master-data/vendors/${row.vendorNo}`}
          className="block max-w-32 truncate underline-offset-4 hover:underline"
          title={row.vendorName}
        >
          {row.vendorName}
        </RecordLink>
      ),
      exportValue: (row) => `${row.vendorNo} ${row.vendorName}`,
    },
  ];
}
