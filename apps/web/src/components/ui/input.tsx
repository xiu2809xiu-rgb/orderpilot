import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL_SKIN } from "./controlSkin";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md px-3 py-1 text-base selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm",
        CONTROL_SKIN,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
