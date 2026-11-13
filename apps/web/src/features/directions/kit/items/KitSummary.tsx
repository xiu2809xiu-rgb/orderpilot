import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "../env";
import { KpiTile } from "../../parts/KpiTile";
import { Section } from "../../parts/Section";
import { itemsOf, KIT_ITEMS } from "./registry";
import type { Vendor } from "./ItemCard";

const JUMPS: readonly { id: string; vendor?: Vendor; key: string }[] = [
  { id: "kit-magic", vendor: "magic", key: "vendors.magic.title" },
  { id: "kit-bits", vendor: "bits", key: "vendors.bits.title" },
  { id: "kit-reui", vendor: "reui", key: "vendors.reui.title" },
  { id: "kit-spark", key: "vendors.spark.title" },
  { id: "kit-grounds", key: "vendors.grounds.title" },
  { id: "kit-parts", key: "parts.title" },
];

const LICENCE: Record<Vendor, string> = {
  magic: "licence.mit",
  bits: "licence.commons",
  reui: "licence.mit",
  orb: "licence.mit",
};

/**
 * The head of the kit-item part of the sheet: how many items there are from
 * each kit, counted from the registry, and a button for each section, which
 * scrolls to it. The counts are product KPI tiles, so they count up once.
 */
export function KitSummary() {
  const { t } = useTranslation("directions-kit-items");
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };
  return (
    <Section
      title={t("summary.title")}
      intro={t("summary.intro", { count: KIT_ITEMS.length })}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(["magic", "bits", "reui", "orb"] as const).map((vendor) => (
          <KpiTile
            key={vendor}
            label={`${t(`vendors.${vendor}.title`)}, ${t(LICENCE[vendor])}`}
            value={itemsOf(vendor)}
            unit={t("summary.items", { count: itemsOf(vendor) })}
          />
        ))}
      </div>
      <nav aria-label={t("summary.jump")} className="mt-4 flex flex-wrap gap-2">
        {JUMPS.map((jumpTo) => (
          <Button
            key={jumpTo.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              jump(jumpTo.id);
            }}
          >
            {t(jumpTo.key)}
          </Button>
        ))}
      </nav>
    </Section>
  );
}
