import type { LucideIcon } from "lucide-react";
import { forwardRef, type ComponentProps } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PanelActionProps extends ComponentProps<"button"> {
  icon: LucideIcon;
  label: string;
  collapsed: boolean;
  /** Why the row does nothing: the row is then plain, with this in its tooltip. */
  unavailable?: string;
}

/**
 * A row of the panel's foot that does something (or says why it does not):
 * Spark, settings, help. It looks like the entries above it, so the foot reads
 * as part of one list.
 */
export const PanelAction = forwardRef<HTMLButtonElement, PanelActionProps>(
  function PanelAction(
    { icon: Icon, label, collapsed, unavailable, className, onClick, ...rest },
    ref,
  ) {
    const row = (
      <button
        ref={ref}
        type="button"
        aria-disabled={unavailable ? "true" : undefined}
        onClick={unavailable ? undefined : onClick}
        className={cn("dx-entry", className)}
        {...rest}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn("min-w-0 truncate", collapsed && "sr-only")}>
          {label}
        </span>
      </button>
    );
    if (!collapsed && !unavailable) return row;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{row}</TooltipTrigger>
        <TooltipContent side="right" className="fs-14">
          {collapsed ? (
            <span className="block font-medium">{label}</span>
          ) : null}
          {unavailable ? <span className="block">{unavailable}</span> : null}
        </TooltipContent>
      </Tooltip>
    );
  },
);
