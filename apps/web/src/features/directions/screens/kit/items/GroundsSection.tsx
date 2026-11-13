import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { Aurora } from "@/components/kit/Aurora";
import { DotPattern } from "@/components/kit/DotPattern";
import { ItemCard } from "./ItemCard";

/** The two grounds: the aurora behind sign-in, and the dots of an empty state. */
export function GroundsSection() {
  const { t } = useTranslation("directions-kit-items");
  return (
    <Section
      id="kit-grounds"
      title={t("vendors.grounds.title")}
      intro={t("vendors.grounds.intro")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ItemCard item="dotPattern" vendor="magic">
          <DotPattern />
          <span className="fs-14 relative text-muted-foreground">
            {t("demo.ground.dots")}
          </span>
        </ItemCard>
        <ItemCard item="aurora" vendor="bits">
          <Aurora />
          <span className="fs-14 relative text-muted-foreground">
            {t("demo.ground.aurora")}
          </span>
        </ItemCard>
      </div>
    </Section>
  );
}
