// Kit: ReUI / badge. Licence: MIT. Adapted to OrderPilot's tokens.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const countBadge = cva(
  "numeral inline-flex shrink-0 items-center justify-center border border-transparent px-1.5 text-center whitespace-nowrap select-none",
  {
    variants: {
      tone: {
        // The accent says "you are here, act now": waiting work gets it.
        accent: "bg-primary text-primary-foreground",
        quiet: "border-border bg-muted text-muted-foreground",
      },
      size: {
        sm: "fs-12 h-5 min-w-5",
        md: "fs-14 h-6 min-w-6",
      },
    },
    defaultVariants: { tone: "accent", size: "sm" },
  },
);

type CountBadgeProps = ComponentProps<"span"> & VariantProps<typeof countBadge>;

/** A number beside a name: tabular. */
export function CountBadge({
  className,
  tone,
  size,
  style,
  ...props
}: CountBadgeProps) {
  return (
    <span
      data-slot="count-badge"
      className={cn(countBadge({ tone, size }), className)}
      style={{ borderRadius: "var(--radius-pill)", ...style }}
      {...props}
    />
  );
}
