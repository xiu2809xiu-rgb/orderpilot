import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/common";

const STEPS = [
  "spr",
  "approved",
  "vendorPo",
  "vendorPi",
  "forwarder",
  "goodsChecked",
  "received",
  "customerTold",
  "vendorPaid",
] as const;

/** The purchase flow, muted and with no counts: it arrives in Phase 2. */
export function PurchaseFlow() {
  const { t } = useTranslation("home");
  return (
    <SectionCard
      title={t("purchase.title")}
      description={t("purchase.description")}
      actions={<Badge variant="outline">{t("purchase.phase")}</Badge>}
    >
      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {STEPS.map((step, index) => (
          <li key={step} className="whitespace-nowrap">
            <span className="tabular-nums">{index + 1}.</span>{" "}
            {t(`purchase.steps.${step}`)}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
