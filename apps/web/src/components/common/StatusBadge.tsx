import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/kit/Badge";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

// The kit's status pill, as the order page and the Orders table draw it.
const TONES = {
  neutral: { icon: CircleDot, variant: "secondary" },
  info: { icon: Info, variant: "info" },
  success: { icon: CircleCheck, variant: "success" },
  warning: { icon: TriangleAlert, variant: "warning" },
  danger: { icon: CircleAlert, variant: "destructive" },
} as const;

/**
 * A status with its words, never colour alone: each tone has its own icon.
 * The area supplies the label from its own text, such as "Waiting for approval".
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, variant } = TONES[tone];
  return (
    <Badge
      variant={variant}
      radius="full"
      className={className}
      data-tone={tone}
    >
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
