import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BarButtonProps {
  label: string;
  icon?: LucideIcon | undefined;
  primary?: boolean;
  /** Why it cannot run yet. The button stays in the Tab order and says so. */
  blocked?: string | undefined;
  shortcut?: string;
  onRun: () => void;
}

/**
 * One button of the form's action bar. A button that cannot run yet is not
 * plain `disabled`: it stays reachable, and its reason is a tooltip and is
 * read out, so a keyboard or touch user learns why too.
 */
export function BarButton({
  label,
  icon: Icon,
  primary = false,
  blocked,
  shortcut,
  onRun,
}: BarButtonProps) {
  const reasonId = useId();
  const button = (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      size="sm"
      aria-disabled={blocked ? true : undefined}
      aria-describedby={blocked ? reasonId : undefined}
      aria-keyshortcuts={shortcut}
      className="pointer-coarse:h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (!blocked) onRun();
      }}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {label}
    </Button>
  );
  if (!blocked) return button;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{blocked}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {blocked}
      </span>
    </>
  );
}
