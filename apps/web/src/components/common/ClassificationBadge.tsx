import { Building2, Globe, Lock, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export const CLASSIFICATIONS = [
  "public",
  "internal",
  "confidential",
  "restricted",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

const LEVELS = {
  public: { icon: Globe, style: "bg-secondary text-secondary-foreground" },
  internal: { icon: Building2, style: "bg-accent text-accent-foreground" },
  confidential: { icon: Lock, style: "bg-warning-surface text-warning" },
  restricted: {
    icon: ShieldAlert,
    style: "bg-destructive/10 text-destructive",
  },
} as const;

/** How sensitive a record is. The data-to-AI policy keys off the same four levels. */
export function ClassificationBadge({ level }: { level: Classification }) {
  const { t } = useTranslation("components");
  const { icon: Icon, style } = LEVELS[level];
  const name = t(`badges.classification.${level}`);
  return (
    <Badge
      className={style}
      data-level={level}
      aria-label={`${t("badges.classification.label")}: ${name}`}
    >
      <Icon aria-hidden="true" />
      {name}
    </Badge>
  );
}
