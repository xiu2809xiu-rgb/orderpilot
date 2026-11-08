import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SalesOrderRow } from "@orderpilot/shared";
import { shortageLabel } from "./shortageLabel";

/**
 * What an order is short of, in one line, so a person can decide what to do
 * about it. The list only says; it never orders anything. The line wraps
 * rather than clip, because a cut item number cannot be acted on.
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
  return (
    <span className="inline-flex min-w-44 items-start gap-1.5 whitespace-normal text-destructive">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium">
        {shortageLabel(shortage, count, t)}
      </span>
    </span>
  );
}
