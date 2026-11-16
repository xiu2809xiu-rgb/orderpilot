import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface TourCardProps {
  index: number;
  total: number;
  stepId: string;
  /** "click": the lit button moves the tour on; "next": the Next button does. */
  advance: "click" | "next";
  nextReady: boolean;
  missing: boolean;
  busy: boolean;
  last: boolean;
  onNext: () => void;
  onEnd: () => void;
}

/**
 * The tour's card: which step of how many, what this step shows and what to
 * say, and one way on. On a "click" step the way on is the lit button itself,
 * so the card only says so, unless the button never appeared, when it offers
 * to skip. Its words change with each step and are read out politely.
 */
export function TourCard(props: TourCardProps) {
  const { t } = useTranslation();
  const { index, total, stepId, advance, nextReady, missing, busy, last } =
    props;
  const next = useRef<HTMLButtonElement>(null);
  const showNext = advance === "next" || missing;
  useEffect(() => {
    // A "next" step hands the keyboard to Next; a "click" step leaves it on the page.
    if (advance === "next") next.current?.focus();
  }, [advance, stepId]);

  return (
    <section
      aria-labelledby="dx-tour-title"
      className="dx-panel-strong flex flex-col gap-3 rounded-[var(--radius-card)] p-5 shadow-lg"
    >
      <p className="fs-12 font-medium text-muted-foreground">
        {t("tour.stepOf", { n: index + 1, total })}
      </p>
      <div aria-live="polite" className="flex flex-col gap-2">
        <h2 id="dx-tour-title" className="fs-16 font-semibold">
          {t(`tour.steps.${stepId}.title`)}
        </h2>
        <p className="fs-14">{t(`tour.steps.${stepId}.body`)}</p>
        {advance === "click" && !missing ? (
          <p className="fs-14 font-medium text-primary">
            {t("tour.clickHint")}
          </p>
        ) : null}
        {missing ? (
          <p className="fs-14 text-muted-foreground">{t("tour.missing")}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={props.onEnd} disabled={busy}>
          {t("tour.end")}
        </Button>
        {showNext ? (
          <Button
            ref={next}
            size="sm"
            onClick={props.onNext}
            disabled={busy || (!missing && !nextReady)}
          >
            {busy
              ? t("tour.finishing")
              : missing
                ? t("tour.skip")
                : last
                  ? t("tour.finish")
                  : t("tour.next")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
