import type { TFunction } from "i18next";
import { Link } from "react-router";
import type { ItemRow } from "@orderpilot/shared";
import type { DataTableColumn } from "@/components/common";
import { formatQuantity } from "@/lib/format";
import { AvailableFigure, MaskedMoney } from "./pieces";

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
        <Link
          to={`/master-data/items/${row.no}`}
          className="font-mono font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.no}
        </Link>
      ),
      exportValue: (row) => row.no,
      sortable: true,
      hideable: false,
    },
    {
      id: "description",
      header: t("items.columns.description"),
      // Capped so that eleven columns fit a laptop screen; the full text is
      // on the item's page and in the export.
      cell: (row) => (
        <span className="block max-w-56 truncate" title={row.description}>
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
      cell: (row) => (
        <AvailableFigure
          value={row.availableStock}
          availability={row.availability}
        />
      ),
      exportValue: (row) => Number(row.availableStock),
      kind: "number",
      sortable: true,
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
        <Link
          to={`/master-data/vendors/${row.vendorNo}`}
          className="block max-w-40 truncate underline-offset-4 hover:underline"
          title={row.vendorName}
        >
          {row.vendorName}
        </Link>
      ),
      exportValue: (row) => `${row.vendorNo} ${row.vendorName}`,
    },
  ];
}
