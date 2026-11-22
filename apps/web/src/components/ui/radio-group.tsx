// Origin: shadcn/ui "radio-group", written out here with our tokens.
import * as React from "react";
import { cn } from "@/lib/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-s2", className)}
      {...props}
    />
  );
}

/**
 * One choice. It is a bare button that carries the roving tab stop and the
 * checked state: the caller draws it (a tile, a pill) through `className` and
 * its children, and styles `[data-state=checked]` or `[aria-checked=true]`.
 */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
