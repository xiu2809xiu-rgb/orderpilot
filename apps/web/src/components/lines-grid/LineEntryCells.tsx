import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  LookupField,
  NumberField,
  TextField,
  type LookupOption,
} from "@/components/form";
import { useGrid } from "./gridContext";
import { MaskedPrice, ReadItem, ReadText } from "./LineReadCells";

interface CellProps {
  index: number;
  row: string;
  readOnly: boolean;
}

export function ItemCell({ index, row, readOnly }: CellProps) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const grid = useGrid();
  if (readOnly) return <ReadItem row={row} />;
  return (
    <LookupField
      control={control}
      name={`${row}.item`}
      label={t("cells.item", { n: index + 1 })}
      hideLabel
      required
      search={grid.searchItems}
      debounceMs={grid.debounceMs}
      placeholder={t("placeholders.item")}
      onPick={(option: LookupOption) => {
        grid.pick(index, option);
      }}
    />
  );
}

export function DescriptionCell({ index, row, readOnly }: CellProps) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  if (readOnly) return <ReadText field="description" row={row} />;
  return (
    <TextField
      control={control}
      name={`${row}.description`}
      label={t("cells.description", { n: index + 1 })}
      hideLabel
      maxLength={100}
    />
  );
}

export function QuantityCell({ index, row, readOnly }: CellProps) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  if (readOnly) return <ReadText field="quantity" row={row} numeric />;
  return (
    <NumberField
      control={control}
      name={`${row}.quantity`}
      label={t("cells.quantity", { n: index + 1 })}
      hideLabel
      required
    />
  );
}

export function PriceCell({ index, row, readOnly }: CellProps) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const { priceMask, itemPrice } = useGrid();
  if (priceMask !== null) return <MaskedPrice />;
  if (readOnly) return <ReadText field="unitPrice" row={row} numeric />;
  return (
    <>
      <NumberField
        control={control}
        name={`${row}.unitPrice`}
        label={t("cells.unitPrice", { n: index + 1 })}
        hideLabel
        scale={2}
      />
      {itemPrice === "reference" ? <ListPrice row={row} /> : null}
    </>
  );
}

/** What master data lists the item at: context for the typed price, never its value. */
function ListPrice({ row }: { row: string }) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const value: unknown = useWatch({ control, name: `${row}.listPrice` });
  const item: unknown = useWatch({ control, name: `${row}.item` });
  // Only the pick writes the list price, so a cleared item would keep the old
  // one: it is shown for an item that is there.
  if (typeof value !== "string" || value === "") return null;
  if (item === undefined || item === null || item === "") return null;
  return (
    <span className="mt-0.5 block text-xs break-words text-muted-foreground tabular-nums @lines:text-right">
      {t("listPrice", { price: value })}
      <span className="sr-only">{t("listPriceNote")}</span>
    </span>
  );
}
