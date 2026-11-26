import { ArrowLeft, Sparkles } from "lucide-react";
import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/kit/Badge";
import type { DemoDocument } from "./demoDocument";

interface ReviewHeadProps {
  document: DemoDocument;
  onAgain: () => void;
  /** Where focus lands when the review opens. */
  headingRef: Ref<HTMLHeadingElement>;
}

/**
 * The band over the review: how the document was classified, which sample it
 * is, and how many fields were read and how many need a person. What is left
 * to approve and Finish review are in the progress card that follows, which
 * stays in view; this band scrolls away.
 */
export function ReviewHead({
  document: doc,
  onAgain,
  headingRef,
}: ReviewHeadProps) {
  const { t } = useTranslation("directions-intake");
  const total = doc.fields.length;
  const unsure = doc.fields.filter((field) => field.uncertain).length;
  const customer = doc.fields.find((field) => field.key === "customerName");
  return (
    <div className="dx-card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="fs-16 font-semibold text-foreground outline-none"
          >
            {t("review.title")}
          </h2>
          <Badge variant="info" size="lg">
            <Sparkles aria-hidden="true" />
            {t("review.classifiedAs", { type: t("review.documentType") })}
          </Badge>
        </div>
        <p className="fs-14 tabular-nums text-faint-foreground">
          {customer
            ? `${doc.documentNumber}, ${customer.text}`
            : doc.documentNumber}
        </p>
        <p className="fs-14 text-foreground">
          {t("review.summary", {
            count: total,
            sure: total - unsure,
            threshold: Math.round(CONFIDENCE_HIGH * 100),
            unsure,
          })}
        </p>
        <p className="fs-12 text-faint-foreground">{t("review.mock")}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onAgain}
        className="pointer-coarse:h-11"
      >
        <ArrowLeft aria-hidden="true" />
        {t("review.again")}
      </Button>
    </div>
  );
}
