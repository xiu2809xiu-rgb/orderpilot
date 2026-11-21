import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SpotlightCard } from "@/components/kit/SpotlightCard";

const STEPS = ["read", "decide", "approve"] as const;

/**
 * AI reads, rules decide, people approve: the three steps as a numbered list
 * of glass cards. A soft light follows the pointer across each one and they
 * arrive one after another.
 */
export function SignInSteps() {
  const { t } = useTranslation("signin");
  return (
    <ol
      aria-label={t("hero.stepsLabel")}
      className="grid max-w-2xl gap-3 sm:grid-cols-3"
    >
      {STEPS.map((step, index) => (
        <li
          key={step}
          className="signin-rise flex"
          style={{ "--d": `${String(700 + index * 120)}ms` } as CSSProperties}
        >
          <SpotlightCard
            className="dx-panel flex w-full flex-col gap-1.5 p-3.5"
            style={{ borderRadius: "var(--radius-card)" }}
          >
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                // Teal, pulled toward the text colour: the plain accent is 3.5:1 on the light ground.
                className="numeral fs-20 leading-none text-[color-mix(in_srgb,var(--primary)_70%,var(--foreground))]"
              >
                {index + 1}
              </span>
              <h2 className="fs-14 font-semibold">
                {t(`hero.steps.${step}.title`)}
              </h2>
            </div>
            <p className="fs-14 text-foreground">
              {t(`hero.steps.${step}.body`)}
            </p>
          </SpotlightCard>
        </li>
      ))}
    </ol>
  );
}
