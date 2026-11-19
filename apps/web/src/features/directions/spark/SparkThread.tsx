import { memo, useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SparkTurnView } from "./SparkTurnView";
import type { SparkKind, Turn } from "./useSparkChat";

interface SparkThreadProps {
  turns: readonly Turn[];
  mayReadSales: boolean;
  /** The panel's scrolling region: the thread moves inside it and nothing else. */
  scroller: RefObject<HTMLElement | null>;
  onFinish: (id: number) => void;
  onAsk: (question: string, kind: SparkKind) => void;
}

/**
 * The conversation. A new question brings its own turn to the top of the
 * scrolling region, so the answer is read from its first line; the parts that
 * follow never move it. Memoised: typing in the input must not redraw it.
 */
export const SparkThread = memo(function SparkThread({
  turns,
  mayReadSales,
  scroller,
  onFinish,
  onAsk,
}: SparkThreadProps) {
  const { t } = useTranslation("directions-spark");
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const region = scroller.current;
    const newest = list.current?.lastElementChild;
    if (!region || !newest) return;
    // Set on the region itself. scrollIntoView would scroll every ancestor
    // too, and moved the whole panel up when the sr-only labels (positioned
    // against the panel) made it look scrollable.
    region.scrollTop =
      region.scrollTop +
      newest.getBoundingClientRect().top -
      region.getBoundingClientRect().top;
  }, [turns.length, scroller]);
  return (
    <ol
      ref={list}
      aria-label={t("thread.label")}
      className="flex flex-col gap-6"
    >
      {turns.map((turn) => (
        <SparkTurnView
          key={turn.id}
          turn={turn}
          mayReadSales={mayReadSales}
          onFinish={onFinish}
          onAsk={onAsk}
        />
      ))}
    </ol>
  );
});
