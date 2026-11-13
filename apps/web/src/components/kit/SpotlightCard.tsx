// Kit: React Bits / SpotlightCard. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import {
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import { useStill } from "./env";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  /** CSS colour of the light: the accent by default. */
  spotlightColor?: string;
  /** Strength of the light, 0 to 1. */
  intensity?: number;
  /** Radius of the light, in pixels. */
  size?: number;
};

/**
 * A card with a soft light that follows the pointer, lighting the surface and
 * its edge. It is for a card people hover to explore (a KPI tile), never for
 * a table row. It only responds to a pointer: the light is not an animation,
 * so there is nothing to pause, and under reduced motion it is switched off.
 * It sets only a surface and an overlay; the design's card look
 * (`dx-card`) stays underneath.
 */
export function SpotlightCard({
  spotlightColor = "var(--ring)",
  intensity = 0.16,
  size = 220,
  className,
  style,
  children,
  onPointerMove,
  onPointerLeave,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStill();

  const move = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const node = ref.current;
    if (!node || still || event.pointerType === "touch") return;
    const box = node.getBoundingClientRect();
    node.style.setProperty(
      "--kit-spot-x",
      `${String(event.clientX - box.left)}px`,
    );
    node.style.setProperty(
      "--kit-spot-y",
      `${String(event.clientY - box.top)}px`,
    );
    node.style.setProperty("--kit-spot-on", "1");
  };
  const leave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    ref.current?.style.setProperty("--kit-spot-on", "0");
  };

  return (
    <div
      ref={ref}
      className={cn("relative isolate overflow-hidden", className)}
      style={
        {
          "--kit-spot-color": spotlightColor,
          "--kit-spot-strength": `${String(Math.round(intensity * 100))}%`,
          "--kit-spot-size": `${String(size)}px`,
          "--kit-spot-on": "0",
          ...style,
        } as CSSProperties
      }
      onPointerMove={move}
      onPointerLeave={leave}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-(--kit-spot-on) transition-opacity duration-200"
        style={{
          background:
            "radial-gradient(var(--kit-spot-size) circle at var(--kit-spot-x, 50%) var(--kit-spot-y, 50%), color-mix(in srgb, var(--kit-spot-color) var(--kit-spot-strength), transparent), transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
