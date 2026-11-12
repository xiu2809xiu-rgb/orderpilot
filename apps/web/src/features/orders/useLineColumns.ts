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
      })),
    [t],
  );
}
