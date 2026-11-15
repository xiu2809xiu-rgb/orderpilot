import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopBarActionProps {
  icon: LucideIcon;
  label: string;
  /** Where it goes, for an action that opens a page. */
  to?: string;
  onClick?: () => void;
  /** The keys that do the same, for assistive tech: `Control+. Meta+.` */
  shortcut?: string;
  /** For a bar too narrow to hold it; the page it opens must be reachable elsewhere. */
  className?: string;
}

/**
 * A labelled button of the top bar: a link to a page, or an action. The label
 * drops to an icon on a narrow bar, and stays the button's name.
 */
export function TopBarAction({
  icon: Icon,
  label,
  to,
  onClick,
  shortcut,
  className,
}: TopBarActionProps) {
  const inner = (
    <>
      <Icon aria-hidden="true" />
      <span className="max-lg:sr-only">{label}</span>
    </>
  );
  if (to) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn("fs-14 dx-bar-action", className)}
      >
        <Link to={to}>{inner}</Link>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("fs-14 dx-bar-action", className)}
      onClick={onClick}
      aria-keyshortcuts={shortcut}
    >
      {inner}
    </Button>
  );
}
