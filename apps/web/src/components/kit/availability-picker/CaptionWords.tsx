// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useStill } from "../env";
import { arrivingOpacity, pickerMotion } from "./pickerMotion";

/** A little after the fade is meant to end, for a tab that never fires its event. */
const LEAVE_NET_MS = 100;

interface Leaving {
  id: number;
  text: string;
  /** The opacity the word had when the caption moved on: its fade starts there. */
  from: number;
}

/**
 * The words in the caption's capsule. When the caption moves to another choice
 * the old word stays and fades out while the new one fades in, both centred, so
 * the capsule is never empty. One old word at most: a second move drops the
 * first. Under reduced motion, and where the kit is still, the words change at
 * once and no old word is drawn. The capsule's box is aria-hidden, so the old
 * word is for the eye only.
 *
 * The old word starts its fade from the opacity it had: a word that was still
 * arriving would otherwise be redrawn at full and flash on a quick move across
 * the choices. One that had not yet become visible (it was still in its wait)
 * leaves nothing behind.
 */
export function CaptionWords({
  stop,
  text,
}: {
  stop: PersonAvailability;
  text: string;
}) {
  const still = useStill();
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const shown = useRef({ stop, text });
  const count = useRef(0);
  // When the current word was drawn: its arriving fade runs from here.
  const arrivedAt = useRef(performance.now());

  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { stop, text };
    if (before.stop === stop) return;
    const now = performance.now();
    const from = arrivingOpacity(now - arrivedAt.current);
    arrivedAt.current = now;
    if (still || from === 0) return;
    count.current += 1;
    setLeaving({
      id: count.current,
      text: before.text,
      from: Math.round(from * 1000) / 1000,
    });
  }, [stop, text, still]);

  useLayoutEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setLeaving(null);
    }, pickerMotion.chipLeaveMs + LEAVE_NET_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [leaving]);

  return (
    <>
      {leaving && !still ? (
        <span
          key={`leaving-${String(leaving.id)}`}
          className="ap-chip-text"
          data-leaving=""
          style={{ "--ap-out-from": leaving.from } as CSSProperties}
          onAnimationEnd={(event) => {
            if (event.animationName === "ap-text-out") setLeaving(null);
          }}
        >
          {leaving.text}
        </span>
      ) : null}
      <span key={stop} className="ap-chip-text">
        {text}
      </span>
    </>
  );
}
