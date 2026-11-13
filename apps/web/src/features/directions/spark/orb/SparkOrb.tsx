import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLatest, useOnScreen, useStill, useTabVisible } from "../../kit/env";
import { Orb as WebGlOrb } from "../../kit/Orb";
import { LiquidOrb } from "./LiquidOrb";
import { orbColours, useOrbTokens, type OrbState } from "./orbPalette";
import "../spark.css";

/** What draws the orb: WebGPU first, then WebGL, then a still picture in CSS. */
export type Engine = "webgpu" | "webgl" | "still";

interface SparkOrbProps {
  state: OrbState;
  /** What a screen reader hears: for example "Spark is idle". */
  label: string;
  className?: string;
  /** Told which engine is drawing, so a screen can say so instead of guessing. */
  onEngine?: (engine: Engine) => void;
}

/**
 * Spark's orb. Idle while it waits, thinking while it works. It tries the
 * WebGPU liquid orb (LerSent001/orb, MIT), falls back to React Bits' WebGL
 * orb, and under reduced motion, or when neither works, shows a still orb
 * drawn in CSS. Its colours are the direction's tokens, it is paused when it
 * is off screen or the tab is hidden, and the pixel ratio is at most 2.
 */
export function SparkOrb({ state, label, className, onEngine }: SparkOrbProps) {
  const still = useStill();
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const orb = useRef<LiquidOrb | null>(null);
  const [engine, setEngine] = useState<Engine>("webgpu");
  const tokens = useOrbTokens();
  const onScreen = useOnScreen(holder);
  const visible = useTabVisible();
  const running = onScreen && visible;
  const latest = useLatest({ tokens, state, running });
  const told = useLatest(onEngine);

  useEffect(() => {
    const node = canvas.current;
    if (still || engine !== "webgpu" || !node) return;
    let cancelled = false;
    let made: LiquidOrb | null = null;
    // Started on the next tick: a development re-mount (StrictMode) runs this
    // effect, cleans up and runs it again at once, and two orbs must not
    // configure the one canvas at the same time.
    const timer = window.setTimeout(() => {
      LiquidOrb.create(node, latest.current.tokens, () => {
        if (!cancelled) setEngine("webgl");
      })
        .then((created) => {
          if (cancelled) {
            created?.destroy();
            return;
          }
          if (!created) {
            setEngine("webgl");
            return;
          }
          made = created;
          orb.current = created;
          told.current?.("webgpu");
          // Catch up with what changed while the GPU was being asked for.
          created.setTokens(latest.current.tokens);
          created.setState(latest.current.state);
          created.setRunning(latest.current.running);
        })
        .catch(() => {
          if (!cancelled) setEngine("webgl");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      orb.current = null;
      made?.destroy();
    };
  }, [still, engine, latest, told]);

  useEffect(() => {
    orb.current?.setTokens(tokens);
  }, [tokens]);
  useEffect(() => {
    orb.current?.setState(state);
  }, [state]);
  useEffect(() => {
    orb.current?.setRunning(running);
  }, [running, engine]);

  const shown: Engine = still ? "still" : engine;
  // WebGPU is reported only once the GPU has answered, not while it is asked.
  useEffect(() => {
    if (shown !== "webgpu") told.current?.(shown);
  }, [shown, told]);

  const colours = orbColours(tokens, state);
  return (
    <div
      ref={holder}
      role="img"
      aria-label={label}
      data-engine={shown}
      data-state={state}
      className={cn("relative aspect-square", className)}
    >
      {still || engine === "still" ? (
        <div
          aria-hidden="true"
          className="spark-orb-still"
          data-state={state}
        />
      ) : engine === "webgl" ? (
        <WebGlOrb
          colours={[colours.b, colours.c, colours.d]}
          ground={colours.canvas}
          thinking={state === "thinking"}
          onUnavailable={() => {
            setEngine("still");
          }}
        />
      ) : (
        <canvas
          ref={canvas}
          aria-hidden="true"
          className="absolute inset-0 block size-full"
        />
      )}
    </div>
  );
}
