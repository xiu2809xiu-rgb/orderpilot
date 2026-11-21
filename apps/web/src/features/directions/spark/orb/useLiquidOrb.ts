import { useEffect, useRef, type RefObject } from "react";
import { useLatest } from "@/components/kit/env";
import { LiquidOrb } from "./LiquidOrb";
import { prepareOrbGpu } from "./orbGpu";
import type { OrbState, OrbTokens } from "./orbPalette";

interface UseLiquidOrb {
  canvas: RefObject<HTMLCanvasElement | null>;
  /** False under reduced motion and once another engine has taken over: no GPU work starts. */
  enabled: boolean;
  tokens: OrbTokens;
  state: OrbState;
  /** On screen and the tab showing: otherwise no frames are drawn. */
  running: boolean;
  /** The orb exists and draws. */
  onCreated: () => void;
  /** WebGPU is missing, lost or failed: the caller draws something else. */
  onFail: () => void;
  /** The first frame is on the screen. */
  onFirstFrame: () => void;
}

/**
 * Borrows the page's GPU program for one canvas and keeps the orb in step
 * with the colours, the state and whether it may draw. The program is made
 * once for the page (orbGpu.ts), so this costs a context, a buffer and a bind
 * group, and the caller never waits for a compile that is already done.
 */
export function useLiquidOrb({
  canvas,
  enabled,
  tokens,
  state,
  running,
  onCreated,
  onFail,
  onFirstFrame,
}: UseLiquidOrb) {
  const orb = useRef<LiquidOrb | null>(null);
  const latest = useLatest({
    tokens,
    state,
    running,
    onCreated,
    onFail,
    onFirstFrame,
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let made: LiquidOrb | null = null;
    prepareOrbGpu()
      .then((gpu) => {
        // A development re-mount cleans this effect up before the program
        // answers. The check and the creation have no gap between them, so
        // only the mount that is still wanted touches the canvas.
        if (cancelled) return;
        const node = canvas.current;
        const created =
          gpu && node
            ? LiquidOrb.create(node, gpu, latest.current.tokens, {
                onFail: () => {
                  if (!cancelled) latest.current.onFail();
                },
                onFirstFrame: () => {
                  if (!cancelled) latest.current.onFirstFrame();
                },
              })
            : null;
        if (!created) {
          latest.current.onFail();
          return;
        }
        made = created;
        orb.current = created;
        latest.current.onCreated();
        // Catch up with what changed while the program was being awaited.
        created.setTokens(latest.current.tokens);
        created.setState(latest.current.state);
        created.setRunning(latest.current.running);
      })
      .catch(() => {
        if (!cancelled) latest.current.onFail();
      });
    return () => {
      cancelled = true;
      orb.current = null;
      made?.destroy();
    };
  }, [enabled, canvas, latest]);

  useEffect(() => {
    orb.current?.setTokens(tokens);
  }, [tokens]);
  useEffect(() => {
    orb.current?.setState(state);
  }, [state]);
  useEffect(() => {
    orb.current?.setRunning(running);
  }, [running, enabled]);
}
