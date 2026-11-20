import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { LineColumn } from "@/components/lines-grid";

const COLUMN_KINDS = [
  "lineNo",
  "item",
  "description",
  "quantity",
  "unitPrice",
  "amount",
  "availability",
  "remove",
] as const;

/** The order form's columns, with their headings in the person's language. */
export function useLineColumns(): LineColumn[] {
  const { t } = useTranslation("orders");
  return useMemo(
    () =>
      COLUMN_KINDS.map((kind) => ({
        kind,
        header: t(`form.lines.columns.${kind}`),
        // The number and the whole name sit in the item cell, so it gets the
        // room first. The description is usually empty: the item has its own.
        ...(kind === "item" ? { width: "minmax(15rem, 3fr)" } : {}),
        ...(kind === "description" ? { width: "minmax(7rem, 1.5fr)" } : {}),
      })),
    [t],
  );
}
