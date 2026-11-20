import { memo, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SparkTurnView } from "./SparkTurnView";
import type { SparkKind, Turn } from "./useSparkChat";
import { useStayAtEnd } from "./useStayAtEnd";

interface SparkThreadProps {
  turns: readonly Turn[];
  mayReadSales: boolean;
  /** The panel's scrolling region: the thread moves inside it and nothing else. */
  scroller: RefObject<HTMLElement | null>;
  onFinish: (id: number) => void;
  onAsk: (question: string, kind: SparkKind) => void;
}

/**
 * The conversation. The scrolling region stays at the end of it while the
 * newest answer is written in and its parts appear, until the person scrolls
 * up; a new question brings it back. Memoised: typing in the input must not
 * redraw it.
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
  useStayAtEnd(scroller, list, turns.length);
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
