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
}: {
  hint: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      <TooltipContent side="bottom" className="fs-14">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
