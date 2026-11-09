import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  LookupField,
  NumberField,
  TextField,
  type LookupOption,
} from "@/components/form";
import { formatDay } from "@/lib/format";
import { useGrid } from "./gridContext";
import { MaskedPrice, ReadItem, ReadText } from "./LineReadCells";
import { lastPriceSchema, type LastPrice } from "./types";

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
      {itemPrice === "reference" ? <LastPriceNote row={row} /> : null}
    </>
  );
}

/**
 * What this order's customer last paid for the item: context for the typed
 * price, never its value. "No earlier price" says the customer never bought it.
 */
function LastPriceNote({ row }: { row: string }) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const value: unknown = useWatch({ control, name: `${row}.lastPrice` });
  const item: unknown = useWatch({ control, name: `${row}.item` });
  // The screen writes the last price for the item on the line, so a cleared
  // item would keep the old one: it is shown for an item that is there.
  if (item === undefined || item === null || item === "") return null;
  const found = lastPriceOf(value);
  if (value !== "none" && found === null) return null;
  return (
    <span className="mt-0.5 block text-xs break-words text-muted-foreground tabular-nums @lines:text-right">
      {found === null
        ? t("noLastPrice")
        : t("lastPrice", {
            price: found.price,
            date: formatDay(found.agreedOn),
          })}
      {found === null ? null : (
        <span className="sr-only">
          {t("lastPriceNote", { document: found.documentNo })}
        </span>
      )}
    </span>
  );
}

function lastPriceOf(value: unknown): LastPrice | null {
  const parsed = lastPriceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
