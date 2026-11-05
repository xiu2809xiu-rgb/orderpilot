import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionButtonProps {
  label: string;
  icon?: LucideIcon | null | undefined;
  primary?: boolean;
  /** Why it cannot run yet. The button stays in the Tab order and says so. */
  blocked?: string | undefined;
  onRun: () => void;
}

/**
 * One button of the action bar. New is the view's only primary button, with
 * its N key; every other action is secondary. A button that cannot run yet is
 * not plain `disabled`: it stays reachable and gives its reason.
 */
export function ActionButton({
  label,
  icon: Icon,
  primary = false,
  blocked,
  onRun,
}: ActionButtonProps) {
  const reasonId = useId();
  const button = (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      size="sm"
      aria-disabled={blocked ? true : undefined}
      aria-describedby={blocked ? reasonId : undefined}
      aria-keyshortcuts={primary ? "N" : undefined}
      className="pointer-coarse:h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (!blocked) onRun();
      }}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {label}
      {primary ? (
        <kbd
          aria-hidden="true"
          className="ml-1 hidden rounded border border-primary-foreground/40 px-1 font-mono text-xs opacity-80 md:inline"
        >
          N
        </kbd>
      ) : null}
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
