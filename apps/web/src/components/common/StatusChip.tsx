import {
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The five families a status falls into on a list. Each has one colour and one
 * icon, so the word is never alone and the colour is never the only signal.
 */
export const STATUS_FAMILIES = [
  "draft",
  "waiting",
  "ready",
  "blocked",
  "done",
] as const;
export type StatusFamily = (typeof STATUS_FAMILIES)[number];

const FAMILIES: Record<
  StatusFamily | "neutral",
  { icon: LucideIcon; style: string }
> = {
  // Draft: grey and dashed, because it is not yet anyone's to act on.
  draft: {
    icon: CircleDashed,
    style:
      "border-dashed border-muted-foreground/50 bg-secondary text-secondary-foreground",
  },
  // Waiting: amber, because someone must do something.
  waiting: { icon: Clock, style: "bg-warning-surface text-warning" },
  // Ready (approved): green, because it may go ahead.
  ready: { icon: CircleCheck, style: "bg-accent text-success" },
  // Blocked (overdue): red, because it needs attention now.
  blocked: { icon: OctagonAlert, style: "bg-destructive/10 text-destructive" },
  // Done: muted and outlined, because it asks nothing of anyone.
  done: {
    icon: CheckCheck,
    style: "border-border bg-transparent text-muted-foreground",
  },
  neutral: { icon: CircleDot, style: "bg-secondary text-secondary-foreground" },
};

/**
 * A status on a list, drawn by its family. The screen passes the family and the
 * words it already has ("Waiting for approval"), so no status code is ever
 * listed in this code. A status with no family shows as neutral.
 */
export function StatusChip({
  family,
  children,
  className,
}: {
  family?: StatusFamily | undefined;
  children: ReactNode;
  className?: string;
}) {
  const key = family ?? "neutral";
  const { icon: Icon, style } = FAMILIES[key];
  return (
    <Badge className={cn(style, className)} data-family={key}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
