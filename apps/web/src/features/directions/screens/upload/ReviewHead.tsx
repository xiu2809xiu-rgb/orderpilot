import { ArrowLeft, FilePlus2, Sparkles } from "lucide-react";
import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "../../kit/Badge";
import { CircularProgress } from "../../kit/CircularProgress";
import type { DemoDocument } from "./demoDocument";

interface ReviewHeadProps {
  document: DemoDocument;
  uncertainCount: number;
  waitingCount: number;
  created: boolean;
  onCreate: () => void;
  onAgain: () => void;
}

/**
 * The band over the review: how the document was classified, how many fields
 * were read and how many need a person, the ring of those confirmed so far,
 * and the one primary button of the screen, Create draft order. The button
 * stays off while an uncertain field is unconfirmed, and says how many.
 */
export function ReviewHead({
  document: doc,
  uncertainCount,
  waitingCount,
  created,
  onCreate,
  onAgain,
}: ReviewHeadProps) {
  const { t } = useTranslation("directions-intake");
  const total = doc.fields.length;
  const confirmed = uncertainCount - waitingCount;
  const customer = doc.fields.find((field) => field.key === "customerName");
  const note = created
    ? ""
    : waitingCount > 0
      ? t("review.createWait", { count: waitingCount })
      : t("review.createReady");
  return (
    <div className="dx-card flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
      <CircularProgress
        label={t("review.ring")}
        value={uncertainCount === 0 ? 100 : (confirmed / uncertainCount) * 100}
        size={64}
      >
        <span className="numeral fs-14 font-semibold">
          {`${String(confirmed)}/${String(uncertainCount)}`}
        </span>
      </CircularProgress>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="fs-16 font-semibold text-foreground">
            {t("review.title")}
          </h2>
          <Badge variant="info" size="lg">
            <Sparkles aria-hidden="true" />
            {t("review.classifiedAs", { type: t("review.documentType") })}
          </Badge>
        </div>
        <p className="numeral fs-13 text-muted-foreground">
          {customer
            ? `${doc.documentNumber}, ${customer.text}`
            : doc.documentNumber}
        </p>
        <p className="fs-14 text-foreground">
          {t("review.summary", {
            count: total,
            sure: total - uncertainCount,
            threshold: Math.round(CONFIDENCE_HIGH * 100),
            unsure: uncertainCount,
          })}
        </p>
        <p className="fs-12 text-muted-foreground">{t("review.mock")}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onAgain}
            className="pointer-coarse:h-11"
          >
            <ArrowLeft aria-hidden="true" />
            {t("review.again")}
          </Button>
          <Button
            type="button"
            disabled={waitingCount > 0 || created}
            onClick={onCreate}
            className="pointer-coarse:h-11"
          >
            <FilePlus2 aria-hidden="true" />
            {t("review.create")}
          </Button>
        </div>
        <p
          className="fs-12 max-w-64 text-right text-muted-foreground"
          role="status"
        >
          {note}
        </p>
      </div>
    </div>
  );
}
