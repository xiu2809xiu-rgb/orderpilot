// From shadcn/ui (new-york), adapted to our tokens: the same skin as Input.
import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL_SKIN } from "./controlSkin";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md px-3 py-2 text-base md:text-sm",
        CONTROL_SKIN,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
