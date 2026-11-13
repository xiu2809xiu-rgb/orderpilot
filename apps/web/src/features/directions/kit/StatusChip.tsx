import type { LucideIcon } from "lucide-react";
import { Badge } from "./Badge";

export type StatusKind = "success" | "warning" | "destructive" | "info";

/**
 * A status: always a word and an icon, never a colour alone. It is the ReUI
 * badge in its status colours, with the direction's own shape: ruled and
 * square in Ink and Paper, a pill in Spectra.
 */
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
    <Badge variant={kind} radius="full">
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
