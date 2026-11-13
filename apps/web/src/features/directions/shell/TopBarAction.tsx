import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopBarActionProps {
  icon: LucideIcon;
  label: string;
  /** Where it goes, when the screen it opens is built. */
  to?: string;
  onClick?: () => void;
  /** Why it does nothing yet. The button is then plain, and says so in a tooltip. */
  unavailable?: string;
}

/**
 * A labelled button of the top bar. The label drops to an icon on a narrow bar.
 * It is a link or a real action, or it says why it is not wired: it never looks
 * pressable and does nothing silently.
 */
export function TopBarAction({
  icon: Icon,
  label,
  to,
  onClick,
  unavailable,
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
        className="fs-14 h-9 pointer-coarse:h-11"
      >
        <Link to={to}>{inner}</Link>
      </Button>
    );
  }
  if (!unavailable) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fs-14 h-9 pointer-coarse:h-11"
        onClick={onClick}
      >
        {inner}
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fs-14 h-9 cursor-default pointer-coarse:h-11"
          aria-disabled="true"
        >
          {inner}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="fs-13">{unavailable}</TooltipContent>
    </Tooltip>
  );
}
