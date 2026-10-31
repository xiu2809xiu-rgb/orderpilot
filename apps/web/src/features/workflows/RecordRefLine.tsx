import type { RecordRef } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";

/** OrderPilot's own number with Navision's beside it. Navision's stays the official one. */
export function RecordRefLine({ value }: { value: RecordRef }) {
  const { t } = useTranslation("workflows");
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span data-numeric className="font-mono text-sm font-medium">
        {value.recordNo}
      </span>
      <span className="text-sm text-muted-foreground">
        {t("task.navision")}:{" "}
        <span data-numeric className="font-mono">
          {value.navisionNo ?? t("task.navisionNone")}
        </span>
      </span>
    </span>
  );
}
