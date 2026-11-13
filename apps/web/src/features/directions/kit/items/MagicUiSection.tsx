import { useTranslation } from "react-i18next";
import { Section } from "../../parts/Section";
import { AnimatedList } from "../AnimatedList";
import { BlurFade } from "../BlurFade";
import { BorderBeam } from "../BorderBeam";
import { CircularProgress } from "../CircularProgress";
import { NumberTicker } from "../NumberTicker";
import { ShineBorder } from "../ShineBorder";
import { ShinyText } from "../ShinyText";
import { ItemCard } from "./ItemCard";

/** Magic UI: motion and patterns, each shown live. */
export function MagicUiSection() {
  const { t } = useTranslation("directions-kit-items");
  const row = (key: string) => (
    <span
      key={key}
      className="fs-14 block border border-border bg-card px-3 py-1.5 text-left text-foreground"
      style={{ borderRadius: "var(--radius-control)" }}
    >
      {t(`demo.rows.${key}`)}
    </span>
  );
  return (
    <Section
      id="kit-magic"
      title={t("vendors.magic.title")}
      intro={t("vendors.magic.intro")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ItemCard item="numberTicker" vendor="magic">
          <NumberTicker value={120} className="fs-32 text-foreground" />
          <span className="fs-14 text-muted-foreground">
            {t("demo.ordersInDataSet")}
          </span>
        </ItemCard>
        <ItemCard item="blurFade" vendor="magic">
          <BlurFade>
            <span className="fs-20 font-semibold text-foreground">
              {t("demo.needsYou")}
            </span>
          </BlurFade>
        </ItemCard>
        <ItemCard item="animatedList" vendor="magic" align="start">
          <AnimatedList className="w-full gap-1.5">
            {row("read")}
            {row("stock")}
            {row("spr")}
          </AnimatedList>
        </ItemCard>
        <ItemCard item="borderBeam" vendor="magic">
          <div
            className="relative border border-border px-4 py-3"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            <BorderBeam />
            <span className="fs-14 text-foreground">{t("demo.reading")}</span>
          </div>
        </ItemCard>
        <ItemCard item="shineBorder" vendor="magic">
          <div
            className="relative px-4 py-3"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            <ShineBorder borderWidth={2} />
            <span className="fs-14 text-foreground">
              {t("demo.stepper.steps.pi")}
            </span>
          </div>
        </ItemCard>
        <ItemCard item="shinyText" vendor="magic">
          <ShinyText className="fs-16">{t("demo.reading")}</ShinyText>
        </ItemCard>
        <ItemCard item="circularProgress" vendor="magic">
          <CircularProgress
            value={6}
            max={9}
            label={t("demo.journeyProgress")}
            size={88}
          >
            <span className="fs-20">6/9</span>
          </CircularProgress>
          <span className="fs-14 text-muted-foreground">
            {t("demo.stepsOfNine")}
          </span>
        </ItemCard>
      </div>
    </Section>
  );
}
