import type { TFunction } from "i18next";
import type { SalesOrderRow } from "@orderpilot/shared";
import { formatQuantity } from "@/lib/format";

/**
 * The shortage as one sentence, for the screen and the export alike. The
 * "and N more" part is part of the locale string, so no words are joined here.
 */
export function shortageLabel(
  shortage: NonNullable<SalesOrderRow["shortage"]>,
  count: number,
  t: TFunction,
): string {
  const values = {
    quantity: formatQuantity(shortage.shortBy),
    itemNo: shortage.itemNo,
  };
  return count > 1
    ? t("shortage.lineWithMore", { ...values, count: count - 1 })
    : t("shortage.line", values);
}
