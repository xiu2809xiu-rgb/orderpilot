import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { BlurText } from "@/components/kit/BlurText";
import { GlassSurface } from "@/components/kit/GlassSurface";
import { GradientText } from "@/components/kit/GradientText";
import { HoldButton } from "@/components/kit/HoldButton";
import { LatticeLoader } from "@/components/kit/LatticeLoader";
import { SpotlightCard } from "@/components/kit/SpotlightCard";
import { StatusMark } from "@/components/kit/StatusMark";
import { ThoughtLine } from "@/components/kit/ThoughtLine";
import { ItemCard } from "./ItemCard";

const STATUSES = ["pending", "running", "done", "failed", "cancelled"] as const;

/** React Bits: figures, type effects, glass and the marks for Spark working. */
export function ReactBitsSection() {
  const { t } = useTranslation("directions-kit-items");
  const hint = useId();
  const [approved, setApproved] = useState(false);
  return (
    <Section
      id="kit-bits"
      title={t("vendors.bits.title")}
      intro={t("vendors.bits.intro")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ItemCard item="gradientText" vendor="bits">
          <GradientText className="fs-32 font-semibold" glow={0.4}>
            {t("demo.insights")}
          </GradientText>
        </ItemCard>
        <ItemCard item="blurText" vendor="bits">
          <BlurText
            text={t("demo.tagline")}
            className="fs-20 font-semibold text-foreground"
          />
        </ItemCard>
        <ItemCard item="spotlightCard" vendor="bits">
          <SpotlightCard
            className="dx-card w-full px-4 py-6"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            <span className="fs-14 text-foreground">{t("demo.pointer")}</span>
          </SpotlightCard>
        </ItemCard>
        <ItemCard item="glassSurface" vendor="bits">
          <GlassSurface className="fs-14 w-full px-4 py-6 text-foreground">
            {t("demo.glass")}
          </GlassSurface>
        </ItemCard>
        <ItemCard item="statusMark" vendor="bits" align="start">
          {STATUSES.map((status) => (
            <StatusMark
              key={status}
              status={status}
              label={t(`demo.status.${status}`)}
              className="fs-14"
            />
          ))}
        </ItemCard>
        <ItemCard item="latticeLoader" vendor="bits" align="start">
          <LatticeLoader label={t("demo.lattice.working")} />
          <LatticeLoader label={t("demo.lattice.done")} status="done" />
          <LatticeLoader label={t("demo.lattice.error")} status="error" />
        </ItemCard>
        <ItemCard item="thoughtLine" vendor="bits" align="start">
          <ThoughtLine
            working
            label={t("demo.thought.working")}
            doneLabel={t("demo.thought.done")}
            toggleLabel={t("demo.thought.toggle")}
          />
          <ThoughtLine
            working={false}
            label={t("demo.thought.working")}
            doneLabel={t("demo.thought.done")}
            toggleLabel={t("demo.thought.toggle")}
            timer={t("demo.thought.timer")}
            steps={[
              t("demo.thought.steps.classified"),
              t("demo.thought.steps.read"),
              t("demo.thought.steps.review"),
            ]}
          />
        </ItemCard>
        <ItemCard item="holdButton" vendor="bits">
          <HoldButton
            describedBy={hint}
            doneLabel={t("demo.hold.done")}
            onHold={() => {
              setApproved(true);
            }}
          >
            {t("demo.hold.label")}
          </HoldButton>
          <span id={hint} className="fs-14 text-muted-foreground">
            {approved ? t("demo.hold.done") : t("demo.hold.hint")}
          </span>
        </ItemCard>
      </div>
    </Section>
  );
}
