import type { SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { LinesTable } from "./LinesTable";

/**
 * The lines of the order, with one sentence above them once the order has taken
 * a revised PO: these are the lines of the current PO version, and the earlier
 * ones are on the Versions tab.
 */
export function LinesTab({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const poVersionNo = detail.poVersionNo ?? 1;
  return (
    <div className="space-y-s2">
      {poVersionNo > 1 ? (
        <p className="fs-14 max-w-prose text-muted-foreground">
          {t("order.lines.currentVersion", { n: poVersionNo })}
        </p>
      ) : null}
      <LinesTable detail={detail} />
    </div>
  );
}
