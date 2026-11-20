import { ArrowDown, ClipboardCheck } from "lucide-react";
import { useEffect, useRef, type Ref } from "react";
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
 * What is left to approve, and the one primary button of the screen, Finish
 * review. It stays under the top bar for the whole review (sticky), so the
 * count and the button are never scrolled away from a person working down the
 * list. Its height is written to `--review-bar` on the review, which the page
 * and the rows use to stop below it: a field being approved is never behind it.
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
        role="status"
      >
        {finished
          ? ""
          : waitingCount > 0
            ? t("review.left", { count: waitingCount })
            : t("review.leftNone")}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onNext ? (
          <Button
            type="button"
            variant="outline"
            onClick={onNext}
            className="pointer-coarse:h-11"
          >
            <ArrowDown aria-hidden="true" />
            {t("review.next")}
          </Button>
        ) : null}
        <Button
          ref={finishRef}
          type="button"
          disabled={waitingCount > 0 || finished}
          onClick={onFinish}
          className="pointer-coarse:h-11"
        >
          <ClipboardCheck aria-hidden="true" />
          {t("review.finish")}
        </Button>
      </div>
    </div>
  );
}
