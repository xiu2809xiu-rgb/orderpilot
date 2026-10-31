import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES = {
  neutral: { icon: CircleDot, style: "bg-secondary text-secondary-foreground" },
  info: { icon: Info, style: "bg-accent text-accent-foreground" },
  success: { icon: CircleCheck, style: "bg-accent text-success" },
  warning: { icon: TriangleAlert, style: "bg-warning-surface text-warning" },
  danger: { icon: CircleAlert, style: "bg-destructive/10 text-destructive" },
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
  const { icon: Icon, style } = TONES[tone];
  return (
    <Badge className={cn(style, className)} data-tone={tone}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
