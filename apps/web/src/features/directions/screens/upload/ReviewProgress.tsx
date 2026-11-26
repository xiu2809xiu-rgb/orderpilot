import { ArrowDown, ClipboardCheck } from "lucide-react";
import { useEffect, useId, useRef, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/kit/CircularProgress";

interface ReviewProgressProps {
  uncertainCount: number;
  waitingCount: number;
  finished: boolean;
  onFinish: () => void;
  /** Selects the next uncertain field nobody has confirmed; undefined when none is left. */
  onNext?: () => void;
  finishRef: Ref<HTMLButtonElement>;
}

/**
 * What is left to approve, and the one filled button of the screen: Next to
 * approve while a field waits (Finish review is off then, so it is an outline),
 * and Finish review once none does. It stays under the top bar for the whole
 * review (sticky), so the count and the buttons are never scrolled away from a
 * person working down the list. Its height is written to `--review-bar` on
 * the review, which the page and the rows use to stop below it: a field being
 * approved is never behind it.
 */
export function ReviewProgress({
  uncertainCount,
  waitingCount,
  finished,
  onFinish,
  onNext,
  finishRef,
}: ReviewProgressProps) {
  const { t } = useTranslation("directions-intake");
  const bar = useRef<HTMLDivElement>(null);
  // The count is also the reason Finish review is off, so the button points at it.
  const statusId = useId();
  useEffect(() => {
    const node = bar.current;
    const stage = node?.closest<HTMLElement>("[data-review-stage]");
    if (!node || !stage) return;
    const measure = () => {
      stage.style.setProperty("--review-bar", `${String(node.offsetHeight)}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  const confirmed = uncertainCount - waitingCount;
  // The live control is the filled one, so a disabled button is never the primary.
  const nextIsLive = waitingCount > 0 && onNext !== undefined;
  return (
    <div
      ref={bar}
      className="dx-card dx-card-work sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
    >
      <CircularProgress
        label={t("review.ring")}
        value={uncertainCount === 0 ? 100 : (confirmed / uncertainCount) * 100}
        size={48}
      >
        <span className="numeral fs-12 font-semibold">
          {`${String(confirmed)}/${String(uncertainCount)}`}
        </span>
      </CircularProgress>
      <p
        className="fs-14 min-w-0 flex-1 basis-48 font-medium text-foreground"
        id={statusId}
        role="status"
      >
        {finished
          ? t("review.finishedShort")
          : waitingCount > 0
            ? t("review.left", { count: waitingCount })
            : t("review.leftNone")}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onNext ? (
          <Button
            type="button"
            variant={nextIsLive ? "default" : "outline"}
            onClick={onNext}
            className="pointer-coarse:h-11"
          >
            <ArrowDown aria-hidden="true" />
            {t("review.next")}
          </Button>
        ) : null}
        {/* Once finished there is nothing left to press: no disabled copy stays. */}
        {finished ? null : (
          <Button
            ref={finishRef}
            type="button"
            variant={nextIsLive ? "outline" : "default"}
            disabled={waitingCount > 0}
            aria-describedby={statusId}
            onClick={onFinish}
            className="pointer-coarse:h-11"
          >
            <ClipboardCheck aria-hidden="true" />
            {t("review.finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
