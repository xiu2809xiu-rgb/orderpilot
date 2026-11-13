import { useTranslation } from "react-i18next";
import { Section } from "../parts/Section";
import { useTokens } from "./useTokens";

const STEPS = [4, 8, 12, 16, 24, 32] as const;
const RADII = [
  ["control", "radius-control"],
  ["card", "radius-card"],
  ["pill", "radius-pill"],
] as const;
const MOTION = [
  ["fast", "motion-fast"],
  ["base", "motion-base"],
  ["slow", "motion-slow"],
] as const;
const NAMES = [...RADII, ...MOTION].map(([, token]) => token);

/** Radius, the 4 px spacing base and the motion durations of the direction. */
export function ShapeSection() {
  const { t } = useTranslation("directions-kit");
  const tokens = useTokens(NAMES);
  return (
    <Section title={t("sections.shape")}>
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <h3 className="fs-13 font-medium">{t("shape.radius")}</h3>
          <ul className="mt-2 space-y-2">
            {RADII.map(([id, token]) => (
              <li key={id} className="flex items-center gap-3">
                <span
                  className="size-9 shrink-0 border-2"
                  style={{
                    borderColor: "var(--primary)",
                    borderRadius: `var(--${token})`,
                  }}
                />
                <span className="fs-13">
                  {t(`shape.${id}`)}{" "}
                  <span className="numeral text-muted-foreground">
                    {tokens[token]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="fs-13 font-medium">{t("shape.spacing")}</h3>
          <ul className="mt-2 space-y-1.5">
            {STEPS.map((px) => (
              <li key={px} className="flex items-center gap-3">
                <span className="fs-12 numeral w-12 shrink-0 text-right text-muted-foreground">
                  {t("shape.px", { px })}
                </span>
                <span
                  className="h-2 bg-primary"
                  style={{ width: px * 3 }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="fs-13 font-medium">{t("shape.motion")}</h3>
          <ul className="mt-2 space-y-2">
            {MOTION.map(([id, token]) => (
              <li key={id} className="fs-13 flex justify-between gap-3">
                <span>{t(`shape.${id}`)}</span>
                <span className="numeral text-muted-foreground">
                  {t("shape.ms", {
                    ms: Number.parseFloat(tokens[token] ?? "0"),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
