import { useEffect, useRef } from "react";
import { deferredModule } from "@/lib/deferred";
import { cn } from "@/lib/utils";
import type { PixelToggleEngine } from "./engine";
import "./pixelToggle.css";

/**
 * The engine (the shader, the painter and the particles) stays out of the
 * entry chunk: the top bar draws this button from CSS alone, and the engine
 * arrives after the first paint and draws over it.
 */
const pixelToggleEngine = deferredModule(() => import("./engine"));

export interface PixelToggleProps {
  /** True is day (the sun), false is night (the moon). */
  checked: boolean;
  /** Called for a person's click, drag or key press, never when `checked` changes from outside. */
  onCheckedChange?: (checked: boolean) => void;
  /** The switch's name for a screen reader. */
  label: string;
  /** The click when a person switches it. On unless false. */
  sound?: boolean;
  className?: string;
}

/**
 * A draggable day-night switch (a glass knob, a pixel moon and sun, a band of
 * light). React owns the button, its name and aria-checked; the engine owns
 * the drawing and its own animated state, and follows `checked` when it
 * changes from outside. The button is as tall as the bar's controls
 * (`--bar-ctl`) and keeps the switch's proportions.
 */
export function PixelToggle({
  checked,
  onCheckedChange,
  label,
  sound = true,
  className,
}: PixelToggleProps) {
  const button = useRef<HTMLButtonElement>(null);
  const engine = useRef<PixelToggleEngine | null>(null);
  // The engine starts later than this render, and calls the handler of the day.
  const latest = useRef({ checked, sound, onCheckedChange });
  useEffect(() => {
    latest.current = { checked, sound, onCheckedChange };
  });

  useEffect(() => {
    let cancelled = false;
    let mounted: PixelToggleEngine | undefined;
    void pixelToggleEngine.load().then(
      (module) => {
        const node = button.current;
        if (cancelled || !node) return;
        mounted = module.mountPixelToggle(node, {
          checked: latest.current.checked,
          sound: latest.current.sound,
          onCheckedChange: (next) => {
            latest.current.onCheckedChange?.(next);
          },
        });
        engine.current = mounted;
      },
      // Without the engine the button still switches, with no animation.
      () => undefined,
    );
    return () => {
      cancelled = true;
      mounted?.destroy();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.update({ checked, sound });
  }, [checked, sound]);

  return (
    <button
      ref={button}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn("pixel-switch", className)}
      onClick={() => {
        // Before the engine arrives (or if it cannot), the click is plain.
        if (!engine.current) onCheckedChange?.(!checked);
      }}
    >
      <span className="pixel-knob" aria-hidden="true" />
    </button>
  );
}
