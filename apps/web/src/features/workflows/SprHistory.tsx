import type { SprDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";

interface Step {
  key: string;
  text: string;
  at?: string;
  note?: string;
  late?: boolean;
}

/**
 * The SPR's approval steps in order, so who asked, who it went to and where
 * the decision stands are on the record itself: requested, sent to the
 * approvers, then the decision or the wait for one.
 */
export function SprHistory({ spr }: { spr: SprDetail }) {
  const { t } = useTranslation("workflows");
  const steps: Step[] = [
    {
      key: "requested",
      text: t("spr.history.requested", { name: spr.requestedBy.name }),
      at: formatDate(spr.requestedAt),
    },
    {
      key: "routed",
      text: t("spr.history.routed"),
      at: formatDate(spr.requestedAt),
    },
  ];
  if (spr.decision) {
    steps.push({
      key: "decided",
      text: t("spr.history.decided", {
        outcome: t(`spr.outcomes.${spr.decision.outcome}`),
        name: spr.decision.by,
      }),
      at: formatDate(spr.decision.at),
      note: spr.decision.comment,
    });
  } else if (spr.due) {
    steps.push({
      key: "waiting",
      text: t(spr.due.overdue ? "spr.history.overdue" : "spr.history.waiting", {
        date: formatDate(spr.due.dueAt),
      }),
      late: spr.due.overdue,
    });
  }

  return (
    <ol className="space-y-s2 border-l border-border pl-s3">
      {steps.map((step) => (
        <li key={step.key} className="space-y-0.5">
          <p className={cn("font-medium", step.late && "text-destructive")}>
            {step.text}
          </p>
          {step.at ? (
            <p className="text-sm text-muted-foreground">{step.at}</p>
          ) : null}
          {step.note ? <p className="text-sm">{step.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
