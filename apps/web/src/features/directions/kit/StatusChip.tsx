import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusKind = "success" | "warning" | "destructive" | "info";

const TONE: Record<StatusKind, string> = {
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  destructive: "bg-destructive-surface text-destructive",
  info: "bg-info-surface text-info",
};

/** A status: always a word and an icon, never a colour alone. */
export function StatusChip({
  kind,
  icon: Icon,
  children,
}: {
  kind: StatusKind;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <span
      className={cn(
        "fs-13 inline-flex items-center gap-1.5 border border-current/25 px-2 py-0.5 font-medium",
        TONE[kind],
      )}
      style={{ borderRadius: "var(--radius-pill)" }}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
