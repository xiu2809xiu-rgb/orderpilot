import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { GlCanvas } from "@/components/kit/canvas/GlCanvas";
import { useTokenRgb } from "@/components/kit/canvas/useTokenRgb";
import { prefersReducedMotion } from "@/components/kit/env";
import { cn } from "@/lib/utils";
import { slotCentre, type BlockState, type ChainModel } from "./chainModel";
import { CHAIN_FRAGMENT, MAX_BLOCKS } from "./chainShader";

// The glass is tinted from the page's ground, not the card's: the build writes
// the card's see-through colour as an 8-digit hex, which the kit cannot read.
const TOKENS = ["--primary", "--destructive", "--foreground", "--background"];
const CODE: Record<BlockState, number> = { waiting: 0, verified: 1, broken: 2 };
/** How long the blocks take to light after a check, left to right. */
const SETTLE_SECONDS = 0.7;
const SETTLE_MS = SETTLE_SECONDS * 1000 + 200;

/**
 * True for a moment after a check ends, so the picture keeps moving while its
 * blocks light up, and then rests. It is set while rendering, from the change
 * itself, so no effect has to set state; the timer only ends it.
 */
function useSettling(travelling: boolean): boolean {
  const [was, setWas] = useState(travelling);
  const [settling, setSettling] = useState(false);
  if (was !== travelling) {
    setWas(travelling);
    setSettling(!travelling);
  }
  useEffect(() => {
    if (!settling) return;
    const timer = window.setTimeout(() => {
      setSettling(false);
    }, SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [settling]);
  return settling;
}

/**
 * The picture of the chain check (F-10): glass blocks in a row, drawn by one
 * shader on the kit's GlCanvas. It is decoration beside the check's words,
 * which stay the result, so it is hidden from screen readers. It moves only
 * while a check runs and while the blocks light after it; it is a still
 * picture under reduced motion, and plain CSS without WebGL2. The only numbers
 * are the ones the check returned, under their blocks.
 */
export function ChainPicture({
  picture,
  brokenLink,
}: {
  picture: ChainModel;
  /** Where the red block goes when clicked: the same event as "Open event N". */
  brokenLink?: { to: string; label: string } | undefined;
}) {
  const { blocks, slots, earlier, travelling } = picture;
  const breaks = blocks.at(-1)?.state === "broken";
  const [accent, bad, ink, ground] = useTokenRgb(TOKENS);
  const [still] = useState(prefersReducedMotion);
  const settling = useSettling(travelling);
  const settleFrom = useRef<number | null>(null);
  const codes = new Float32Array(MAX_BLOCKS);
  blocks.slice(0, MAX_BLOCKS).forEach((block, index) => {
    codes[index] = CODE[block.state];
  });
  const key = [
    [accent, bad, ink, ground].map((c) => c?.join(",") ?? "").join("|"),
    blocks.map((block) => block.state).join(","),
    String(slots),
    String(earlier),
    String(travelling),
    String(settling),
  ].join(";");

  return (
    <div aria-hidden="true" data-chain-picture="">
      <div className="relative h-28">
        <GlCanvas
          fragment={CHAIN_FRAGMENT}
          redrawKey={key}
          paused={!travelling && !settling}
          stillTime={0.4}
          fallback={{
            backgroundImage:
              "radial-gradient(closest-side, color-mix(in srgb, var(--primary) 20%, transparent), transparent)",
            backgroundSize: `calc(100% / ${String(slots)}) 60%`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center",
          }}
          draw={(gl, uniform, time) => {
            // Lit at once when it cannot move, or once the settle is over.
            let settle = 1;
            if (settling && !still) {
              settleFrom.current ??= time;
              settle = Math.min(
                1,
                (time - settleFrom.current) / SETTLE_SECONDS,
              );
            } else {
              settleFrom.current = null;
            }
            gl.uniform1f(uniform("uSlots"), slots);
            gl.uniform1f(
              uniform("uCount"),
              Math.min(blocks.length, MAX_BLOCKS),
            );
            gl.uniform1fv(uniform("uState"), codes);
            gl.uniform1f(uniform("uEarlier"), earlier ? 1 : 0);
            gl.uniform1f(uniform("uTravel"), travelling ? 1 : 0);
            gl.uniform1f(uniform("uSettle"), settle);
            gl.uniform3fv(uniform("uAccent"), accent ?? [0, 0, 0]);
            gl.uniform3fv(uniform("uBad"), bad ?? [0, 0, 0]);
            gl.uniform3fv(uniform("uInk"), ink ?? [0, 0, 0]);
            gl.uniform3fv(uniform("uGround"), ground ?? [1, 1, 1]);
          }}
        />
        {brokenLink && breaks ? (
          // For a mouse only. The keyboard and a screen reader have "Open
          // event N" under the picture, so this one is out of the tab order.
          <Link
            to={brokenLink.to}
            tabIndex={-1}
            title={brokenLink.label}
            aria-label={brokenLink.label}
            data-chain-break=""
            className="absolute inset-y-0 rounded-md transition-colors duration-200 ease-out hover:bg-destructive/5"
            style={{
              left: `${String((slotCentre(blocks.length - 1, blocks.length, slots) - 0.5 / slots) * 100)}%`,
              width: `${String(100 / slots)}%`,
            }}
          />
        ) : null}
      </div>
      <div className="relative h-5 text-xs text-muted-foreground tabular-nums">
        {blocks.map((block, index) =>
          block.sequence === null ? null : (
            <span
              // One block, one place: the index is its identity here.
              key={index}
              className={cn(
                "absolute top-0 -translate-x-1/2",
                block.state === "broken" && "font-medium text-destructive",
              )}
              style={{
                left: `${String(slotCentre(index, blocks.length, slots) * 100)}%`,
              }}
            >
              {block.sequence}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
