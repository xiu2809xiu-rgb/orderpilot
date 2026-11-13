// Kit: ReUI / frame. Licence: MIT. Adapted to OrderPilot's tokens.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A frame holds one or more panels in a quiet tray: an outer rim, then the
 * panels inset by a few pixels, each with a smaller radius so the corners run
 * parallel. It is how Orders groups its table and its peek, and how a detail
 * page sets a group of related panels together. The panel radius is the
 * frame's less its padding, from the card radius.
 */
export function Frame({ className, style, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="frame"
      className={cn(
        "relative flex flex-col gap-1 border border-border bg-muted/50 p-1 [--kit-frame-pad:4px]",
        className,
      )}
      style={{ borderRadius: "var(--radius-card)", ...style }}
      {...props}
    />
  );
}

export function FramePanel({
  className,
  style,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="frame-panel"
      className={cn(
        "relative min-w-0 grow overflow-hidden border border-border bg-card p-4 text-card-foreground",
        className,
      )}
      style={{
        borderRadius:
          "max(0px, calc(var(--radius-card) - var(--kit-frame-pad) - 1px))",
        ...style,
      }}
      {...props}
    />
  );
}

export function FrameHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      data-slot="frame-header"
      className={cn("flex flex-col gap-0.5 px-4 py-2", className)}
      {...props}
    />
  );
}

export function FrameTitle({
  className,
  children,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="frame-title"
      className={cn("fs-14 font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function FrameDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="frame-description"
      className={cn("fs-14 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function FrameFooter({ className, ...props }: ComponentProps<"footer">) {
  return (
    <footer
      data-slot="frame-footer"
      className={cn("flex items-center gap-2 px-4 py-2", className)}
      {...props}
    />
  );
}
