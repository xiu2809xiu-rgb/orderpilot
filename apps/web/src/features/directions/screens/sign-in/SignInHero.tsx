import { useTranslation } from "react-i18next";
import { formatLongDay } from "@/lib/format";
import { BlurFade } from "../../kit/BlurFade";
import { BlurText } from "../../kit/BlurText";
import { Brand } from "../../shell/Brand";

const STEPS = ["read", "decide", "approve"] as const;

/**
 * The promise, on the left of the sign-in page: the date, the tagline set as
 * a headline that sharpens word by word, the one-line lead and the three
 * steps. The headline is the page's h1; the animation is decoration and the
 * whole sentence is in the markup for a screen reader.
 */
export function SignInHero() {
  const { t } = useTranslation("directions-home");
  const { t: tCommon } = useTranslation();
  return (
    <section
      aria-labelledby="dx-signin-promise"
      className="flex min-w-0 flex-col justify-between gap-10 px-6 py-8 lg:px-14 lg:py-14"
    >
      {/* A panel, as the app's own top bar is: the aurora behind it is too bright for small grey text. */}
      <div
        className="dx-panel flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5"
        style={{ borderRadius: "var(--radius-card)" }}
      >
        <Brand collapsed={false} />
        <p className="dx-title-context">{formatLongDay(new Date())}</p>
      </div>
      <div className="flex max-w-2xl flex-col gap-5">
        <h1
          id="dx-signin-promise"
          className="dx-knock fs-44 font-semibold tracking-tight text-balance max-lg:text-(length:--type-28)"
        >
          <BlurText text={tCommon("app.tagline")} stagger={0.12} />
        </h1>
        <BlurFade delay={0.5}>
          <p className="dx-knock fs-16 max-w-prose text-muted-foreground">
            {t("signin.lead")}
          </p>
        </BlurFade>
      </div>
      <ol
        aria-label={t("signin.stepsLabel")}
        className="dx-knock grid max-w-2xl gap-5 sm:grid-cols-3"
      >
        {STEPS.map((step, index) => (
          <li key={step}>
            <BlurFade
              delay={0.7 + index * 0.12}
              className="flex flex-col gap-2"
            >
              <span
                aria-hidden="true"
                className="numeral fs-28 block leading-none text-ring [[data-direction=paper]_&]:text-(length:--type-44)"
              >
                {index + 1}
              </span>
              <h2 className="fs-14 font-semibold">
                {t(`signin.steps.${step}.title`)}
              </h2>
              <p className="fs-13 text-muted-foreground">
                {t(`signin.steps.${step}.body`)}
              </p>
            </BlurFade>
          </li>
        ))}
      </ol>
    </section>
  );
}
