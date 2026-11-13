// Kit: React Bits / SplitFlapText. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useOnScreen, useStill } from "./env";
import "./kit.css";

interface SplitFlapProps {
  /** The text to show: digits and capitals flip, punctuation stays put. */
  value: string;
  /** Characters a tile cycles through before it settles. */
  charset?: string;
  /** How many characters a tile flips through on the way. */
  flips?: number;
  /** Milliseconds between one tile starting and the next. */
  stagger?: number;
  className?: string;
}

interface Tile {
  char: string;
  prev: string;
  tick: number;
}

const NUMERIC = "0123456789";
const FLIP_MS = 90;

const flippable = (char: string) => /[0-9A-Za-z]/.test(char);

const settled = (value: string): Tile[] =>
  Array.from(value).map((char) => ({ char, prev: char, tick: 0 }));

/**
 * Numerals that flip into place like a departures board, once, when first on
 * screen. It is Ink's figure: a number is a reading on an instrument. The
 * tiles are decoration (`aria-hidden`); the value is in the markup for a
 * screen reader. React Bits' item draws a 3D hinge and a drop shadow; Ink has
 * no shadows, so this keeps its "minimal" tile: two halves, one revealed as
 * the other is covered. Under reduced motion the value is there at once.
 */
export function SplitFlap({
  value,
  charset = NUMERIC,
  flips = 4,
  stagger = 60,
  className,
}: SplitFlapProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true });
  const [tiles, setTiles] = useState<Tile[]>(() => settled(value));

  useEffect(() => {
    if (still || !seen) {
      setTiles(settled(value));
      return;
    }
    const timers: number[] = [];
    const target = Array.from(value);
    const pool = charset.length > 0 ? charset : NUMERIC;
    target.forEach((final, index) => {
      if (!flippable(final)) return;
      for (let step = 0; step <= flips; step += 1) {
        timers.push(
          window.setTimeout(
            () => {
              setTiles((current) =>
                current.map((tile, at) => {
                  if (at !== index) return tile;
                  const next =
                    step === flips
                      ? final
                      : (pool[Math.floor(Math.random() * pool.length)] ??
                        final);
                  return { char: next, prev: tile.char, tick: tile.tick + 1 };
                }),
              );
            },
            index * stagger + step * FLIP_MS,
          ),
        );
      }
    });
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [value, still, seen, charset, flips, stagger]);

  return (
    <span
      ref={ref}
      className={cn("numeral inline-flex items-center gap-[0.08em]", className)}
    >
      <span className="sr-only">{value}</span>
      {tiles.map((tile, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn("kit-flap-tile", tile.tick > 0 && "kit-flap-run")}
          data-narrow={flippable(tile.char) ? undefined : ""}
        >
          <span
            key={`t${String(tile.tick)}`}
            className="kit-flap-half kit-flap-top"
          >
            <span className="kit-flap-char">{tile.char}</span>
          </span>
          <span
            key={`b${String(tile.tick)}`}
            className="kit-flap-half kit-flap-bottom"
          >
            <span className="kit-flap-char">{tile.prev}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
