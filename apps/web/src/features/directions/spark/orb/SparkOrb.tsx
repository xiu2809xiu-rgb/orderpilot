import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  useLatest,
  useOnScreen,
  useStill,
  useTabVisible,
} from "@/components/kit/env";
import { Orb as WebGlOrb } from "@/components/kit/Orb";
import { useOrbTokens, webglLook, type OrbState } from "./orbPalette";
import { useLiquidOrb } from "./useLiquidOrb";
import { gpuApi } from "./webgpu";
import "../spark.css";

/** What draws the orb: WebGPU first, then WebGL, then a picture in CSS. */
export type Engine = "webgpu" | "webgl" | "still";

/** The fade from the CSS orb to the drawn one, as long as spark.css says. */
const FADE_MS = 200;

interface SparkOrbProps {
  state: OrbState;
  /** What a screen reader hears: for example "Spark is idle". */
  label: string;
  className?: string;
  /** Told which engine is drawing, so a screen can say so instead of guessing. */
  onEngine?: (engine: Engine) => void;
}

/**
 * Spark's orb. Idle while it waits, thinking while it works. An orb drawn in
 * CSS is on screen from the first render, so there is never an empty square.
 * The WebGPU liquid orb (LerSent001/orb, MIT) is drawn over it, on a program
 * the page prepared once (orbGpu.ts), and fades in when its first frame is
 * on the screen; the CSS orb is then taken out. Where WebGPU is missing it is
 * React Bits' WebGL orb in the same way. Under reduced motion, or when
 * neither works, the CSS orb stays: still under reduced motion, otherwise
 * moving gently. The colours are the design tokens, nothing is drawn while
 * the orb is off screen or the tab is hidden, and the pixel ratio is at most 2.
 * `data-showing` says which of them the person can see.
 */
export function SparkOrb({ state, label, className, onEngine }: SparkOrbProps) {
  const still = useStill();
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // WebGPU is asked for only where the browser has it: elsewhere WebGL starts at once.
  const [engine, setEngine] = useState<Engine>(() =>
    gpuApi() ? "webgpu" : "webgl",
  );
  const [painted, setPainted] = useState<Engine | null>(null);
  const [covered, setCovered] = useState<Engine | null>(null);
  const tokens = useOrbTokens();
  const onScreen = useOnScreen(holder);
  const visible = useTabVisible();
  const told = useLatest(onEngine);

  useLiquidOrb({
    canvas,
    enabled: !still && engine === "webgpu",
    tokens,
    state,
    running: onScreen && visible,
    onCreated: () => {
      told.current?.("webgpu");
    },
    onFail: () => {
      setEngine("webgl");
    },
    onFirstFrame: () => {
      setPainted("webgpu");
    },
  });

  // The CSS orb goes once the drawn one has faded in over it, so that nothing
  // animates underneath. Both are derived from the engine, so when WebGPU is
  // lost after it was shown, the CSS orb comes back under the WebGL orb.
  useEffect(() => {
    if (painted === null) return;
    const timer = window.setTimeout(() => {
      setCovered(painted);
    }, FADE_MS + 20);
    return () => {
      window.clearTimeout(timer);
    };
  }, [painted]);

  const shown: Engine = still ? "still" : engine;
  // WebGPU is reported only once the GPU has answered, not while it is asked.
  useEffect(() => {
    if (shown !== "webgpu") told.current?.(shown);
  }, [shown, told]);

  const ready = painted === shown;
  const showCss = shown === "still" || covered !== shown;
  const look = webglLook(tokens, state);
  return (
    <div
      ref={holder}
      role="img"
      aria-label={label}
      data-engine={shown}
      data-showing={ready ? shown : "css"}
      data-state={state}
      className={cn("relative aspect-square", className)}
    >
      {showCss ? (
        <div
          aria-hidden="true"
          className="spark-orb-still"
          data-state={state}
        />
      ) : null}
      {shown === "webgl" ? (
        <div
          data-ready={ready}
          className={cn(
            "spark-orb-layer absolute",
            look.disc ? "spark-orb-disc" : "inset-0",
          )}
        >
          <WebGlOrb
            colours={look.colours}
            ground={look.ground}
            thinking={state === "thinking"}
            onFirstFrame={() => {
              setPainted("webgl");
            }}
            onUnavailable={() => {
              setEngine("still");
            }}
          />
        </div>
      ) : null}
      {shown === "webgpu" ? (
        <canvas
          ref={canvas}
          aria-hidden="true"
          data-ready={ready}
          className="spark-orb-layer absolute inset-0 block size-full"
        />
      ) : null}
    </div>
  );
}
