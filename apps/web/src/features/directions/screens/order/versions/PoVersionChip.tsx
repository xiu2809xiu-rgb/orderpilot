import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { Badge } from "@/components/kit/Badge";
import { focusTabPanel } from "./focusTabPanel";

/**
 * "PO version 2" beside the entry badge, only once an order has taken a revised
 * PO. It opens the Versions tab, and brings the tab's panel into view and
 * focuses it, since a phone shows the tabs below the status card.
 */
export function PoVersionChip({ poVersionNo }: { poVersionNo: number | null }) {
  const { t } = useTranslation("directions-orders");
  const [params, setParams] = useSearchParams();
  if (poVersionNo === null || poVersionNo <= 1) return null;
  return (
    <Link
      to="?tab=versions"
      replace
      aria-label={t("order.poVersionChipLabel", { n: poVersionNo })}
      className="inline-flex items-center rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:min-h-11"
      onClick={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params);
        next.set("tab", "versions");
        setParams(next, { replace: true });
        focusTabPanel("versions");
      }}
    >
      <Badge variant="outline" radius="full">
        {t("order.poVersionChip", { n: poVersionNo })}
      </Badge>
    </Link>
  );
}
