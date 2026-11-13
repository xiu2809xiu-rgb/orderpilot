import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { prefersReducedMotion } from "../kit/env";
import { SparkTurnView } from "./SparkTurnView";
import type { SparkKind, Turn } from "./useSparkChat";

interface SparkThreadProps {
  turns: readonly Turn[];
  mayReadSales: boolean;
  onFinish: (id: number) => void;
  onAsk: (question: string, kind: SparkKind) => void;
}

/** The conversation, scrolled to its newest line as it grows. */
export function SparkThread({
  turns,
  mayReadSales,
  onFinish,
  onAsk,
}: SparkThreadProps) {
  const { t } = useTranslation("directions-spark");
  const list = useRef<HTMLOListElement>(null);
  // A new question brings its own turn to the top of the panel, so the answer
  // is read from its first line; the parts that follow never move the page.
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [turns.length]);
  return (
    <>
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
    </>
  );
}
