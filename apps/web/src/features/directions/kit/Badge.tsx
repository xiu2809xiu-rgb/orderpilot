// Kit: ReUI / badge. Licence: MIT. Adapted to OrderPilot's tokens.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 border border-transparent font-medium whitespace-nowrap select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5",
  {
    variants: {
      // The status surfaces and info are not in the app's Tailwind theme, so they
      // are read as variables.
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-success/25 bg-(--success-surface) text-success",
        warning: "border-warning/25 bg-warning-surface text-warning",
        destructive:
          "border-destructive/25 bg-(--destructive-surface) text-destructive",
        info: "border-(--info)/25 bg-(--info-surface) text-(--info)",
      },
      size: {
        sm: "fs-12 h-5 min-w-5 px-1.5",
        default: "fs-13 h-6 min-w-6 px-2",
        lg: "fs-14 h-7 min-w-7 px-2.5",
      },
      // The direction decides what "default" and "full" look like.
      radius: { default: "", full: "" },
    },
    defaultVariants: { variant: "default", size: "default", radius: "default" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

/**
 * A small label for a stage, a status or a count. A status badge always
 * carries an icon and a word (pass both as children). Its radius is the
 * direction's: square in Ink and Paper, a pill in Spectra, unless `radius`
 * says "full".
 */
export function Badge({
  className,
  variant,
  size,
  radius,
  style,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, radius }), className)}
      style={{
        borderRadius:
          radius === "full" ? "var(--radius-pill)" : "var(--radius-control)",
        ...style,
      }}
      {...props}
    />
  );
}
