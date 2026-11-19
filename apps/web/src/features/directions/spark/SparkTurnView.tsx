import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ShinyText } from "@/components/kit/ShinyText";
import { ThoughtLine } from "@/components/kit/ThoughtLine";
import { StockAnswerParts, stockSentence } from "./answers/StockAnswer";
import { TrendAnswerParts, trendSentence } from "./answers/TrendAnswerParts";
import { SparkChoices } from "./SparkChoices";
import { stockFacts, trendFacts } from "./sparkFacts";
import { suggestionsFor } from "./suggestions";
import type { SparkKind, Turn } from "./useSparkChat";
import { useWordStream } from "./useWordStream";

interface SparkTurnViewProps {
  turn: Turn;
  mayReadSales: boolean;
  onFinish: (id: number) => void;
  onAsk: (question: string, kind: SparkKind) => void;
}

const STEPS: Record<SparkKind, readonly string[]> = {
  stock: ["read", "found", "added"],
  trend: ["read", "added", "forecast"],
  other: ["read"],
};

/**
 * One exchange: what the person asked, Spark's thought line (what it looked
 * at, and how long it took), the answer streaming in with a quiet shimmer, and
 * once it is told, the parts that go with it (a table, a chart, a draft). A
 * stopped turn keeps what had been said and says it was stopped.
 */
export function SparkTurnView({
  turn,
  mayReadSales,
  onFinish,
  onAsk,
}: SparkTurnViewProps) {
  const { t } = useTranslation("directions-spark");
  const stock = useMemo(() => stockFacts(), []);
  const trend = useMemo(() => trendFacts(), []);
  const text =
    turn.kind === "stock"
      ? stockSentence(t, stock)
      : turn.kind === "trend"
        ? trendSentence(t, trend)
        : t("other.answer", { count: suggestionsFor(mayReadSales).length });
  const streaming = turn.phase === "streaming";
  const settled = turn.phase === "done" || turn.phase === "stopped";
  const shown = useWordStream(text, streaming, settled, () => {
    onFinish(turn.id);
  });
  const steps = STEPS[turn.kind].map((step) =>
    step === "found"
      ? t("thought.stock.steps.found", { count: stock.items.length })
      : t(`thought.${turn.kind}.steps.${step}`),
  );
  const seconds =
    turn.seconds === null
      ? undefined
      : t("thought.seconds", { value: turn.seconds.toFixed(1) });
  const done = turn.phase === "done";
  return (
    <li className="flex flex-col gap-3">
      <div className="flex justify-end">
        <p
          className="fs-14 max-w-[85%] bg-secondary px-3 py-2 text-secondary-foreground"
          style={{ borderRadius: "var(--radius-card)" }}
        >
          <span className="sr-only">{t("thread.you")}: </span>
          {turn.question}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <ThoughtLine
          working={turn.phase === "thinking"}
          label={t(`thought.${turn.kind}.working`)}
          doneLabel={t(`thought.${turn.kind}.done`)}
          steps={steps}
          timer={seconds}
          toggleLabel={t("thought.toggle")}
        />
        {turn.phase === "thinking" ? null : (
          <>
            <p
              className="fs-12 w-fit border border-border px-2 py-0.5 text-muted-foreground"
              style={{ borderRadius: "var(--radius-control)" }}
            >
              {t("scripted")}
            </p>
            <p className="fs-14 text-foreground">
              <span className="sr-only">{t("thread.spark")}: </span>
              {streaming ? (
                <ShinyText className="block">{shown}</ShinyText>
              ) : (
                shown
              )}
            </p>
            {turn.phase === "stopped" ? (
              <p className="fs-14 text-muted-foreground">
                {t("thread.stopped")}
              </p>
            ) : null}
            {done && turn.kind === "stock" ? (
              <StockAnswerParts facts={stock} />
            ) : null}
            {done && turn.kind === "trend" ? (
              <TrendAnswerParts facts={trend} />
            ) : null}
            {done && turn.kind === "other" ? (
              <SparkChoices mayReadSales={mayReadSales} onAsk={onAsk} />
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
