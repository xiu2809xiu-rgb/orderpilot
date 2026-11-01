import { useTranslation } from "react-i18next";
import { FlowSlot } from "./FlowSlot";
import { PromiseSteps } from "./PromiseSteps";
import { useAuthOptions } from "./useAuthOptions";

/**
 * OrderPilot's promise, beside the form on a wide screen and under it on a
 * phone: the tagline, the three steps and the animated order flow.
 */
export function SignInPromise() {
  const { t } = useTranslation("signin");
  const { t: tCommon } = useTranslation();
  const demo = useAuthOptions().data?.demoMode === true;

  return (
    <section
      aria-labelledby="promise-title"
      className="flex flex-col justify-center bg-accent px-s2 py-s4 text-foreground sm:px-s4 lg:px-s6 lg:py-s8"
    >
      <div className="mx-auto w-full max-w-xl space-y-s3 lg:space-y-s4">
        <div className="space-y-2">
          <p className="hidden text-xs font-semibold uppercase tracking-wider text-accent-foreground md:block">
            {t("promise.eyebrow")}
          </p>
          <h2
            id="promise-title"
            className="text-2xl font-semibold tracking-tight text-accent-foreground lg:text-3xl"
          >
            {tCommon("app.tagline")}
          </h2>
          <p className="measure hidden text-foreground/80 md:block">
            {t("promise.lead")}
          </p>
        </div>
        <FlowSlot />
        <PromiseSteps />
        {demo ? (
          <p className="measure text-xs text-foreground/80">
            {t("promise.demoNote")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
