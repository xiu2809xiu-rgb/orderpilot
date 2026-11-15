import { Suspense, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { SignInLead } from "./SignInLead";
import { SignInSteps } from "./SignInSteps";

/**
 * The promise, beside the form on a wide screen and under it on a phone: the
 * tagline set as the page's headline, then a lead and the three steps. The
 * headline comes from the common text, so it is on the page at once; the lead
 * and the steps load their own text, and the form never waits for any of it.
 * The words sharpen one by one with plain CSS (signin.css): there is no
 * animation library on this page.
 */
export function SignInHero() {
  const { t } = useTranslation();
  const words = t("app.tagline").split(" ");
  return (
    <section
      aria-labelledby="signin-promise"
      className="flex min-w-0 flex-col justify-between gap-10 col-start-1 row-start-3 lg:row-span-2 lg:row-start-2"
    >
      <div className="my-auto flex max-w-2xl flex-col gap-5">
        <h1
          id="signin-promise"
          className="fs-32 max-w-lg font-semibold tracking-tight text-balance max-lg:text-(length:--type-28)"
        >
          <span className="sr-only">{t("app.tagline")}</span>
          <span aria-hidden="true">
            {words.map((word, index) => (
              <span
                key={`${word}-${String(index)}`}
                className="signin-word"
                style={{ "--i": index } as CSSProperties}
              >
                {word}
                {index < words.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        </h1>
        <Suspense fallback={null}>
          <SignInLead />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SignInSteps />
      </Suspense>
    </section>
  );
}
