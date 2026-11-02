import { TriangleAlert } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Money } from "@/components/common";
import { formatQuantity } from "@/lib/format";
import { amountOfLine, readLines, shortfallOfLine } from "./lineMath";
import { useGrid } from "./gridContext";
import { MaskedPrice } from "./LineReadCells";

/** What a line costs, worked out again on every keystroke from decimal strings. */
export function AmountCell({ row }: { row: string }) {
  const { control } = useFormContext();
  const { priceMask } = useGrid();
  const [line] = readLines([useWatch({ control, name: row })]);
  if (priceMask !== null) return <MaskedPrice />;
  const amount = line
    ? amountOfLine({
        quantity: line.quantity ?? "",
        unitPrice: line.unitPrice ?? "",
      })
    : null;
  return (
    <span className="block min-h-8 py-1.5 text-right text-sm">
      {amount === null ? (
        <span className="text-muted-foreground">-</span>
      ) : (
        <Money value={amount} />
      )}
    </span>
  );
}

function unitOf(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  return "unit" in value && typeof value.unit === "string" ? value.unit : "";
}

/**
 * The item's available stock, as the API reported it when the item was picked.
 * Short lines say so in words, beside the colour, and leave room for an action.
 */
export function AvailabilityCell({
  index,
  row,
}: {
  index: number;
  row: string;
}) {
  const { t } = useTranslation("linesGrid");
  const { control } = useFormContext();
  const grid = useGrid();
  const whole: unknown = useWatch({ control, name: row });
  const [line] = readLines([whole]);
  const unit = unitOf(whole);
  if (!line?.item) {
    return (
      <span className="block py-1.5 text-sm text-muted-foreground">
        <span aria-hidden="true">-</span>
        <span className="sr-only">{t("availability.noItem")}</span>
      </span>
    );
  }
  if (line.availableStock === null || line.availableStock === undefined) {
    return (
      <span className="block py-1.5 text-sm text-muted-foreground">
        {t("availability.unknown")}
      </span>
    );
  }
  const short = shortfallOfLine(line, index);
  const stock = `${formatQuantity(line.availableStock)} ${unit}`.trim();
  if (!short) {
    return (
      <span className="block py-1.5 text-sm tabular-nums">
        {t("availability.available", { stock })}
      </span>
    );
  }
  return (
    <div className="space-y-1 rounded-md border border-warning/40 bg-warning-surface px-2 py-1.5 text-xs text-warning">
      <p className="flex items-center gap-1 text-sm font-medium">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        {t("availability.short", { by: formatQuantity(short.shortBy) })}
      </p>
      <p className="tabular-nums">
        {t("availability.detail", {
          needed: formatQuantity(short.needed),
          available: stock,
        })}
      </p>
      {grid.shortfallAction?.(short)}
    </div>
  );
}
