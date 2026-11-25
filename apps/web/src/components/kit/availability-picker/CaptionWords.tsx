// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { useStill } from "../env";
import { pickerMotion } from "./pickerMotion";

/** A little after the fade is meant to end, for a tab that never fires its event. */
const LEAVE_NET_MS = 100;

interface Leaving {
  id: number;
  text: string;
}

/**
 * The words in the caption's capsule. When the caption moves to another choice
 * the old word stays and fades out while the new one fades in, both centred, so
 * the capsule is never empty. One old word at most: a second move drops the
 * first. Under reduced motion, and where the kit is still, the words change at
 * once and no old word is drawn. The capsule's box is aria-hidden, so the old
 * word is for the eye only.
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

  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { stop, text };
    if (still || before.stop === stop) return;
    count.current += 1;
    setLeaving({ id: count.current, text: before.text });
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
