import type { OrderTimelineEvent } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { latestAct, latestWords } from "./newestAct";

/**
 * The newest act a person made on the order, who and when, with the way to
 * the order's steps. It comes from the workflow's record, so a role that may
 * not read it, an order the workflow does not know, or a record with no act by
 * a person all leave no line at all, and no error.
 */
export function LatestAct({
  orderNo,
  timeline,
  now = new Date(),
}: {
  orderNo: string;
  timeline: readonly OrderTimelineEvent[] | undefined;
  /** The moment the page is read at; only a test passes it. */
  now?: Date;
}) {
  const { t } = useTranslation("directions-orders");
  const entry = timeline ? latestAct(timeline, now) : null;
  if (!entry) return null;
  return (
    <p className="od-latest fs-14 text-muted-foreground">
      <span>{latestWords(t, entry)}</span>
      <Button asChild variant="outline" size="sm">
        <Link to={`/workflows/orders/${encodeURIComponent(orderNo)}`}>
          {t("order.latest.steps")}
        </Link>
      </Button>
    </p>
  );
}
