import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import { ArrowUpRight } from "lucide-react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/kit/Alert";
import { orderHref } from "../home/homeLinks";

export interface DoneCounts {
  confirmed: number;
  corrected: number;
  readAlone: number;
}

/**
 * The end of the review, in the person's terms: what they confirmed and
 * corrected, and what the reader read above the threshold, such as "1 field
 * confirmed by you, 15 fields read above 90 percent". Then, in one sentence,
 * that nothing was saved and which order the sample belongs to.
 */
export function ReviewDone({
  counts,
  orderNo,
  linkRef,
}: {
  counts: DoneCounts;
  orderNo: string;
  linkRef: Ref<HTMLAnchorElement>;
}) {
  const { t } = useTranslation("directions-intake");
  const parts = [
    counts.confirmed > 0
      ? t("review.done.confirmed", { count: counts.confirmed })
      : null,
    counts.corrected > 0
      ? t("review.done.corrected", { count: counts.corrected })
      : null,
  ].filter((part) => part !== null);
  const yours = parts.length > 0 ? parts.join(", ") : t("review.done.none");
  const reader = t("review.done.reader", {
    count: counts.readAlone,
    threshold: Math.round(CONFIDENCE_HIGH * 100),
  });
  return (
    <Alert variant="success">
      <AlertTitle>
        {t("review.finishedTitle", { summary: `${yours}, ${reader}` })}
      </AlertTitle>
      <AlertDescription>
        {t("review.finishedBody", { order: orderNo })}
      </AlertDescription>
      <AlertAction>
        <Button asChild variant="outline" size="sm">
          <Link ref={linkRef} to={orderHref(orderNo)}>
            {t("review.openOrder", { order: orderNo })}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </AlertAction>
    </Alert>
  );
}
