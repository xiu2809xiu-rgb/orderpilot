// Kit: React Bits / GlassSurface. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type GlassSurfaceProps = ComponentProps<"div"> & {
  /** Use the opaque panel: a surface that holds a table or a form. */
  work?: boolean;
  /** Blur in pixels behind the glass. */
  blur?: number;
};

/**
 * A pane of frosted glass: the panel colour over a blur and a saturation
 * lift, with a hairline highlight along the top edge and the glow. It is the
 * design's surface. Only the CSS-filter path of React Bits' item is kept; its
 * SVG refraction is dropped because it bends the text behind it, and text on
 * a surface must stay readable.
 */
export function GlassSurface({
  work = false,
  blur = 18,
  className,
  style,
  children,
  ...props
}: GlassSurfaceProps) {
  const filter = `blur(${String(blur)}px) saturate(140%)`;
  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        background: work ? "var(--panel-strong)" : "var(--panel)",
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--glow)",
        ...style,
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
      />
      {children}
    </div>
  );
}
