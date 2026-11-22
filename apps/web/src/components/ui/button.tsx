import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { iconEdge } from "@/lib/iconEdge";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/*
 * Optical alignment of a button that has an icon beside its label. An arrow
 * after the label leaves empty space inside its own box (3.3 px at 16 px for
 * ArrowRight), so the right side looks roomier than the left and the content
 * sits 1.15 px left of centre; an icon before the label does the same the
 * other way, 0.7 px. The content is moved by that much: the padding on one
 * side grows and the padding on the other shrinks by the same amount, so the
 * button keeps its height and its width. `--optical-icon-end` and
 * `--optical-icon-start` are in styles/tokens.css, and `data-icon-edge` is
 * set by `iconEdge` (lib/iconEdge.ts). The base padding of each size is the
 * one its has-[>svg] class sets.
 */
const ICON_EDGE = {
  default:
    "data-[icon-edge=end]:ps-[calc(--spacing(3)+var(--optical-icon-end))] data-[icon-edge=end]:pe-[calc(--spacing(3)-var(--optical-icon-end))] data-[icon-edge=start]:ps-[calc(--spacing(3)-var(--optical-icon-start))] data-[icon-edge=start]:pe-[calc(--spacing(3)+var(--optical-icon-start))]",
  xs: "data-[icon-edge=end]:ps-[calc(--spacing(1.5)+var(--optical-icon-end))] data-[icon-edge=end]:pe-[calc(--spacing(1.5)-var(--optical-icon-end))] data-[icon-edge=start]:ps-[calc(--spacing(1.5)-var(--optical-icon-start))] data-[icon-edge=start]:pe-[calc(--spacing(1.5)+var(--optical-icon-start))]",
  sm: "data-[icon-edge=end]:ps-[calc(--spacing(2.5)+var(--optical-icon-end))] data-[icon-edge=end]:pe-[calc(--spacing(2.5)-var(--optical-icon-end))] data-[icon-edge=start]:ps-[calc(--spacing(2.5)-var(--optical-icon-start))] data-[icon-edge=start]:pe-[calc(--spacing(2.5)+var(--optical-icon-start))]",
  lg: "data-[icon-edge=end]:ps-[calc(--spacing(4)+var(--optical-icon-end))] data-[icon-edge=end]:pe-[calc(--spacing(4)-var(--optical-icon-end))] data-[icon-edge=start]:ps-[calc(--spacing(4)-var(--optical-icon-start))] data-[icon-edge=start]:pe-[calc(--spacing(4)+var(--optical-icon-start))]",
} as const;

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // A coarse pointer (a finger) gets 44 px at least, whatever the size
        // says: the warehouse works on tablets, and a page that sets its own
        // height still cannot make a button smaller than a fingertip.
        default: `h-9 px-4 py-2 has-[>svg]:px-3 pointer-coarse:min-h-11 ${ICON_EDGE.default}`,
        xs: `h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 pointer-coarse:min-h-11 [&_svg:not([class*='size-'])]:size-3 ${ICON_EDGE.xs}`,
        sm: `h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 pointer-coarse:min-h-11 ${ICON_EDGE.sm}`,
        lg: `h-10 rounded-md px-6 has-[>svg]:px-4 pointer-coarse:min-h-11 ${ICON_EDGE.lg}`,
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs":
          "size-6 rounded-md pointer-coarse:size-11 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 pointer-coarse:size-11",
        "icon-lg": "size-10 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-icon-edge={iconEdge(props.children, asChild)}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
