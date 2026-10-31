import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

export type DemoBadgeKind = "mock" | "mockAi" | "synthetic";

const KEYS = {
  mock: ["badges.mock", "badges.mockHint"],
  mockAi: ["badges.mockAi", "badges.mockAiHint"],
  synthetic: ["badges.synthetic", "badges.syntheticHint"],
} as const;

/**
 * "Mock", "Mock AI" or "Synthetic demo data": the labels that stop a demo
 * being mistaken for the real thing. The hint is a tooltip.
 */
export function DemoBadge({ kind }: { kind: DemoBadgeKind }) {
  const { t } = useTranslation("components");
  const [label, hint] = KEYS[kind];
  return (
    <Badge variant="outline" title={t(hint)} data-kind={kind}>
      <FlaskConical aria-hidden="true" />
      {t(label)}
    </Badge>
  );
}
