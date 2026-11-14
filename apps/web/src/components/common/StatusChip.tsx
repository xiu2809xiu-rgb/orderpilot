import {
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Clock,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/kit/Badge";
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

// The look is the kit's status pill, the one the Orders table and the order
// page draw, so a status reads the same on every screen. The family only picks
// the variant and the icon.
const FAMILIES: Record<
  StatusFamily | "neutral",
  {
    icon: LucideIcon;
    variant: ComponentProps<typeof Badge>["variant"];
    style?: string;
  }
> = {
  // Draft: grey and dashed, because it is not yet anyone's to act on.
  draft: {
    icon: CircleDashed,
    variant: "secondary",
    style: "border-dashed border-muted-foreground/50",
  },
  // Waiting: amber, because someone must do something.
  waiting: { icon: Clock, variant: "warning" },
  // Ready (approved): green, because it may go ahead.
  ready: { icon: CircleCheck, variant: "success" },
  // Blocked (overdue): red, because it needs attention now.
  blocked: { icon: OctagonAlert, variant: "destructive" },
  // Done: muted and outlined, because it asks nothing of anyone.
  done: {
    icon: CheckCheck,
    variant: "outline",
    style: "text-muted-foreground",
  },
  neutral: { icon: CircleDot, variant: "secondary" },
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
  const { icon: Icon, variant, style } = FAMILIES[key];
  return (
    <Badge
      variant={variant}
      radius="full"
      className={cn(style, className)}
      data-family={key}
    >
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
