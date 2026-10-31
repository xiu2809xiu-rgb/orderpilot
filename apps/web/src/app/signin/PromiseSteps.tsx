import { useTranslation } from "react-i18next";

const STEPS = ["read", "decide", "approve"] as const;

/**
 * The three steps in reading order. On a phone only the titles show, in a row;
 * from tablet width each step has its sentence. It is text, so a screen reader
 * gets the whole promise whether or not the animation is there.
 */
export function PromiseSteps() {
  const { t } = useTranslation("signin");
  return (
    <ol
      aria-label={t("promise.stepsLabel")}
      className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-s2"
    >
      {STEPS.map((step, index) => (
        <li key={step} className="flex gap-2 md:gap-3">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground md:size-7 md:text-sm"
          >
            {index + 1}
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold leading-6 md:text-base md:leading-7">
              {t(`promise.steps.${step}.title`)}
            </h3>
            <p className="measure hidden text-sm text-foreground/80 md:block">
              {t(`promise.steps.${step}.body`)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
