import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

const STEPS = ["read", "decide", "approve"] as const;

/** AI reads, rules decide, people approve: the three steps as a numbered list. */
export function SignInSteps() {
  const { t } = useTranslation("signin");
  return (
    <ol
      aria-label={t("hero.stepsLabel")}
      // Under the form on a phone the steps meet the ground's brightest bloom (4.5:1 by a hair): a soft scrim of the page colour keeps them readable at any width.
      className="grid max-w-2xl gap-5 max-lg:-mx-3 max-lg:rounded-(--radius-card) max-lg:bg-[color-mix(in_srgb,var(--background)_55%,transparent)] max-lg:p-3 sm:grid-cols-3"
    >
      {STEPS.map((step, index) => (
        <li
          key={step}
          className="signin-rise flex flex-col gap-2"
          style={{ "--d": `${String(700 + index * 120)}ms` } as CSSProperties}
        >
          <span
            aria-hidden="true"
            // Teal, pulled toward the text colour: the plain accent is 3.5:1 on the light ground.
            className="numeral fs-28 block leading-none text-[color-mix(in_srgb,var(--primary)_70%,var(--foreground))]"
          >
            {index + 1}
          </span>
          <h2 className="fs-14 font-semibold">
            {t(`hero.steps.${step}.title`)}
          </h2>
          <p className="fs-14 text-foreground">
            {t(`hero.steps.${step}.body`)}
          </p>
        </li>
      ))}
    </ol>
  );
}
