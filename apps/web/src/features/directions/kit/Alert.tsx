// Kit: ReUI / alert. Licence: MIT. Adapted to OrderPilot's tokens.
import { cva, type VariantProps } from "class-variance-authority";
import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[1rem_1fr] items-start gap-x-3 gap-y-0.5 border px-3.5 py-3",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground [&>svg]:text-ring",
        info: "border-info/30 bg-info-surface [&>svg]:text-info",
        success: "border-success/30 bg-success-surface [&>svg]:text-success",
        warning: "border-warning/30 bg-warning-surface [&>svg]:text-warning",
        destructive:
          "border-destructive/30 bg-destructive-surface [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type Variant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const ICON: Record<Variant, LucideIcon> = {
  default: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleX,
};

/**
 * A message that sits in the page: what happened and what to do about it. It
 * always has an icon and a title, so the tone is never colour alone. Only
 * `destructive` is announced at once (`role="alert"`); the others are polite
 * (`role="status"`), because most messages here (a refused file, a held
 * payment) are not emergencies. Use `AlertAction` for the one next step.
 */
export function Alert({
  variant = "default",
  className,
  children,
  style,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = ICON[variant ?? "default"];
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      style={{ borderRadius: "var(--radius-card)", ...style }}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4" />
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("fs-14 col-start-2 font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "fs-13 col-start-2 grid justify-items-start gap-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("col-start-2 mt-2 flex gap-2", className)}
      {...props}
    />
  );
}
