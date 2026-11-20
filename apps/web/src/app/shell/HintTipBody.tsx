import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The tooltip under a button of the top bar. Loaded by `HintTip`, which
 * decides when it is open. Its anchor is an empty box over the button, so the
 * button itself is not given to the tooltip.
 */
export default function HintTipBody({
  hint,
  open,
  onOpenChange,
  onPointerEnter,
  onPointerLeave,
}: {
  hint: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The pointer on the tip keeps it open, so its text can be read: WCAG 2.2, 1.4.13. */
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <span
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0"
        />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="fs-14"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
