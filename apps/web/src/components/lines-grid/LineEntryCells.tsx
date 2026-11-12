import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  LookupField,
  NumberField,
  TextField,
  type LookupOption,
} from "@/components/form";
import { formatDay, formatMoney } from "@/lib/format";
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
 * price, never its value. "No earlier price" says the customer never bought
 * it, and "Last price not known" that the lookup failed.
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
  const className =
    "mt-0.5 text-xs break-words text-muted-foreground tabular-nums @lines:text-right";
  if (found === null) {
    if (value === "none") {
      return <span className={`${className} block`}>{t("noLastPrice")}</span>;
    }
    if (value === "unknown") {
      return (
        <span className={`${className} block`}>{t("unknownLastPrice")}</span>
      );
    }
    return null;
  }
  const amount = formatMoney(found.price);
  const date = formatDay(found.agreedOn);
  const full = t("lastPriceFull", {
    amount,
    date,
    document: found.documentNo,
  });
  // Two short lines that never break inside the amount or the date. A screen
  // reader hears the full sentence once, not the visible fragments.
  return (
    <span
      title={full}
      className={`${className} flex flex-col @lines:items-end`}
    >
      <span className="sr-only">{full}</span>
      <span aria-hidden="true" className="whitespace-nowrap">
        {t("lastPriceAmount", { amount })}
      </span>
      <span aria-hidden="true" className="whitespace-nowrap">
        {t("lastPriceDate", { date })}
      </span>
    </span>
  );
}

function lastPriceOf(value: unknown): LastPrice | null {
  const parsed = lastPriceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
