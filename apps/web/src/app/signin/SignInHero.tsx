import { Suspense, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { BlurText } from "@/components/kit/BlurText";
import { SignInLead } from "./SignInLead";
import { SignInStage } from "./SignInStage";
import { SignInSteps } from "./SignInSteps";

// The closing words carry the design's title gradient (large type only).
const HEADLINE_GRADIENT = {
  "--kit-gradient":
    "linear-gradient(100deg, var(--dx-title-from), var(--dx-title-to), var(--dx-title-from))",
  "--kit-gradient-duration": "9s",
} as CSSProperties;

/**
 * The promise, beside the form on a wide screen and under it on a phone: the
 * tagline set as the page's headline, a lead, the hero stage and the three
 * steps. The headline comes from the common text, so it is on the page at
 * once; the lead, the stage and the steps load their own text, and the form
 * never waits for any of it. The words sharpen in one by one, once.
 */
export function SignInHero() {
  const { t } = useTranslation();
  const tagline = t("app.tagline");
  const words = tagline.split(" ");
  return (
    <section
      aria-labelledby="signin-promise"
      className="flex min-w-0 flex-col justify-between gap-6 col-start-1 row-start-3 lg:row-span-2 lg:row-start-2 lg:gap-7"
    >
      <div className="flex max-w-2xl flex-col gap-4">
        <h1
          id="signin-promise"
          style={HEADLINE_GRADIENT}
          className="fs-32 max-w-lg font-semibold tracking-tight text-balance max-lg:text-(length:--type-28)"
        >
          <BlurText
            text={tagline}
            stagger={0.11}
            delay={0.1}
            accentFrom={words.length - 2}
            accentClassName="kit-gradient-text"
          />
        </h1>
        <Suspense fallback={null}>
          <SignInLead />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SignInStage />
      </Suspense>
      <Suspense fallback={null}>
        <SignInSteps />
      </Suspense>
    </section>
  );
}
