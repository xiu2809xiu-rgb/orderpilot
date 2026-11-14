import type { TFunction } from "i18next";
import { formatQuantity } from "@/lib/format";
import type { OrderRow } from "./orderRow";

/**
 * The shortage as one sentence, for the tooltip, the screen reader and the
 * export alike, so a file says what the screen says. The "and N more" part
 * lives in the locale string, so no words are joined here.
 */
export function shortSentence(
  row: Pick<OrderRow, "shortage" | "shortageCount">,
  t: TFunction,
): string {
  const gap = row.shortage;
  if (!gap) return "";
  const values = {
    quantity: formatQuantity(gap.shortBy),
    itemNo: gap.itemNo,
  };
  return row.shortageCount > 1
    ? t("cells.shortLineMore", { ...values, count: row.shortageCount - 1 })
    : t("cells.shortLine", values);
}
