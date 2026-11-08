import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SalesOrderRow } from "@orderpilot/shared";
import { formatQuantity } from "@/lib/format";

/**
 * What an order is short of, in one line, so a person can decide what to do
 * about it. The list only says; it never orders anything.
 */
export function ShortageLine({
  shortage,
  count,
}: {
  shortage: SalesOrderRow["shortage"];
  count: number;
}) {
  const { t } = useTranslation("orders");
  if (!shortage) {
    return <span className="text-muted-foreground">{t("shortage.none")}</span>;
  }
  const more = count > 1 ? `, ${t("shortage.more", { count: count - 1 })}` : "";
  return (
    <span className="inline-flex items-center gap-1.5 text-destructive">
      <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium">
        {t("shortage.line", {
          quantity: formatQuantity(shortage.shortBy),
          itemNo: shortage.itemNo,
        })}
        {more}
      </span>
    </span>
  );
}
