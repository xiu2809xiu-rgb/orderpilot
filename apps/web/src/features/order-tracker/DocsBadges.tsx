import type { TrackerOrder } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LIFECYCLE_STAGES } from "./trackerParams";
import { stageTabOf } from "./trackerParams";

type DocCode = "P" | "I" | "L" | "A";
type DocState = "passed" | "failed" | "pending";

const DOC_CODES: readonly DocCode[] = ["P", "I", "L", "A"];

/**
 * How many of the four documents each lifecycle stage has reached. A concept
 * only: the tracker list carries no per-document check result today (only
 * the order's own detail page does, per check, not per document), so this
 * guesses each document's state from the stage the order's real status
 * falls into. It goes once the list reports a real per-document summary.
 */
const STAGE_REACHED: Record<(typeof LIFECYCLE_STAGES)[number]["id"], number> = {
  draft: 1,
  pendingApproval: 1,
  processing: 3,
  shipped: 4,
  completed: 4,
};

/**
 * The four documents' concept state for one order: how far the stage its
 * real status sits in has reached, with one of the reached documents shown
 * as failed when the order already has open exceptions. It never invents a
 * mismatch where `openExceptions` is zero.
 */
export function docBadgesOf(
  row: TrackerOrder,
): { code: DocCode; state: DocState }[] {
  const stage = stageTabOf(row.status.code);
  const reached = stage === "all" ? 0 : STAGE_REACHED[stage];
  // No recognised stage means no guess at which document is "current", so an
  // unrecognised status never gets a fabricated failure.
  const failedIndex = reached > 0 && row.openExceptions > 0 ? reached - 1 : -1;
  return DOC_CODES.map((code, index) => ({
    code,
    state:
      index === failedIndex ? "failed" : index < reached ? "passed" : "pending",
  }));
}

const BADGE_STYLE: Record<DocState, string> = {
  passed: "bg-accent text-success",
  failed: "bg-destructive/10 text-destructive border border-destructive/30",
  pending:
    "border border-dashed border-muted-foreground/40 bg-secondary text-muted-foreground",
};

/**
 * A concept column: four one-letter badges for the purchase order, the
 * invoice, the packing list and the AWB, coloured by `docBadgesOf`'s guess
 * at each one's state. Labelled plainly in code and to screen readers as a
 * concept, since it is not yet backed by a real per-document check result.
 */
export function DocsBadges({ row }: { row: TrackerOrder }) {
  const { t } = useTranslation("order-tracker");
  const badges = docBadgesOf(row);
  return (
    <span className="flex items-center gap-1">
      {badges.map(({ code, state }) => {
        const label = t(`list.docs.labels.${code}`);
        const description =
          state === "failed"
            ? t("list.docs.failed", { count: row.openExceptions, label })
            : state === "passed"
              ? t("list.docs.passed", { label })
              : t("list.docs.pending", { label });
        return (
          <Tooltip key={code}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={description}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold pointer-coarse:size-11 pointer-coarse:text-xs",
                  BADGE_STYLE[state],
                )}
              >
                {code}
              </button>
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
