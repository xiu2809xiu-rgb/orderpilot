// Origin: shadcn/ui "switch", written out here with our tokens.
import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // The look stays 36 by 20 (a 1 px border each side); a coarse pointer reaches 44 by 44 through
        // an invisible layer, so a row of switches does not grow.
        "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
        "pointer-coarse:after:absolute pointer-coarse:after:-inset-x-[5px] pointer-coarse:after:-inset-y-[13px] pointer-coarse:after:content-['']",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input hover:data-[state=unchecked]:bg-input/80",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
