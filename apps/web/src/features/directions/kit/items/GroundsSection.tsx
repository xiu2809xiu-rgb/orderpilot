import { useTranslation } from "react-i18next";
import { Section } from "../../parts/Section";
import { Aurora } from "../Aurora";
import { Dither } from "../Dither";
import { DotPattern } from "../DotPattern";
import { ItemCard } from "./ItemCard";

/** The three sign-in grounds, each drawn in the current direction's accent. */
export function GroundsSection() {
  const { t } = useTranslation("directions-kit-items");
  return (
    <Section
      title={t("vendors.grounds.title")}
      intro={t("vendors.grounds.intro")}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <ItemCard item="dither" vendor="bits">
          <Dither />
          <span className="fs-13 relative text-muted-foreground">
            {t("demo.ground.ink")}
          </span>
        </ItemCard>
        <ItemCard item="dotPattern" vendor="magic">
          <DotPattern />
          <span className="fs-13 relative text-muted-foreground">
            {t("demo.ground.paper")}
          </span>
        </ItemCard>
        <ItemCard item="aurora" vendor="bits">
          <Aurora />
          <span className="fs-13 relative text-muted-foreground">
            {t("demo.ground.spectra")}
          </span>
        </ItemCard>
      </div>
    </Section>
  );
}
