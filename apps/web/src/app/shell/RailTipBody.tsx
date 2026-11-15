import type { ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** The tooltip beside a row of the rail. Loaded by `RailTip`. */
export default function RailTipBody({
  tip,
  children,
}: {
  tip: ReactNode;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="fs-14">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
