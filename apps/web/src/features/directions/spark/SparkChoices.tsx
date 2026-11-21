import { useTranslation } from "react-i18next";
import { suggestionsFor } from "./suggestions";
import type { SparkKind } from "./useSparkChat";

interface SparkChoicesProps {
  mayReadSales: boolean;
  onAsk: (question: string, kind: SparkKind) => void;
}

const CHOICE =
  "fs-14 min-h-9 border border-border bg-card px-3 text-left outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

/**
 * Under the plain reply to a question Spark cannot answer: one button for each
 * question it can really answer for this role, so the next step is one press.
 */
export function SparkChoices({ mayReadSales, onAsk }: SparkChoicesProps) {
  const { t } = useTranslation("directions-spark");
  return (
    <div className="flex flex-wrap gap-2">
      {suggestionsFor(mayReadSales).map(({ kind }) => (
        <button
          key={kind}
          type="button"
          onClick={() => {
            onAsk(t(`empty.${kind}`), kind);
          }}
          className={CHOICE}
          style={{ borderRadius: "var(--radius-control)" }}
        >
          {t(`empty.${kind}`)}
        </button>
      ))}
    </div>
  );
}
