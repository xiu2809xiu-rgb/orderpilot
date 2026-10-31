import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";

interface ConfidenceBadgeProps {
  /** A ratio from 0 to 1, as the shared contract holds it. */
  confidence: number;
  /** Set once a person has confirmed the value. */
  approved?: boolean;
}

export function confidenceBand(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

const BAND_STYLE = {
  high: "bg-accent text-success",
  medium: "bg-warning-surface text-warning",
  low: "bg-destructive/10 text-destructive",
} as const;

/**
 * How sure the AI is, and the rule that a person still decides. Until a
 * person approves, it says "Requires approval", however high the score.
 */
export function ConfidenceBadge({
  confidence,
  approved,
}: ConfidenceBadgeProps) {
  const { t } = useTranslation("components");
  const band = confidenceBand(confidence);
  const percent = `${String(Math.round(confidence * 100))}%`;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      title={t("confidence.hint")}
    >
      <Badge className={BAND_STYLE[band]} data-band={band}>
        <Sparkles aria-hidden="true" />
        {t("confidence.label", { percent })}
        <span className="sr-only">{`, ${t(`confidence.${band}`)}`}</span>
      </Badge>
      <StatusBadge tone={approved ? "success" : "warning"}>
        {approved ? t("confidence.approved") : t("confidence.requiresApproval")}
      </StatusBadge>
    </span>
  );
}
