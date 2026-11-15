import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Text kept to one line, ending in an ellipsis when the column is narrower
 * than it. The whole text shows on hover and on keyboard focus, so a cut
 * word is never the only way to read it. The span takes focus itself (a
 * title attribute does not show on focus).
 */
export function ClampedText({
  children,
  className,
}: {
  children: string;
  className: string;
}): ReactNode {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // A button would stop a click on the text from opening the row, and
          // focus is the only way a keyboard reaches the cut text.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className={cn(
            "block truncate rounded-sm focus-visible:outline-2 focus-visible:outline-ring",
            className,
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
