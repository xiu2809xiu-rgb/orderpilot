import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { SecondStepBoundary } from "./SecondStepBoundary";
import type { TwoStepStepProps } from "./TwoStepStep";
import { TwoStepFallback } from "./TwoStepFallback";

// The second step, its field and their styles load only when a password
// sign-in asks for one: the sign-in page's first load stays small.
const loadStep = () =>
  lazy(() => import("./TwoStepStep").then((m) => ({ default: m.TwoStepStep })));

/**
 * Where the second step appears. Each time it opens it makes its own lazy
 * component: React keeps a failed import for the life of the component, so a
 * shared one would fail again at the next sign-in until the page was reloaded.
 */
export function SecondStepSlot(props: TwoStepStepProps) {
  const { t } = useTranslation("signin");
  const [Step] = useState(loadStep);
  return (
    <SecondStepBoundary
      message={t("twoStep.loadFailed")}
      backLabel={t("twoStep.back")}
      onBack={props.onBack}
    >
      <Suspense fallback={<TwoStepFallback label={t("twoStep.loading")} />}>
        <Step {...props} />
      </Suspense>
    </SecondStepBoundary>
  );
}
