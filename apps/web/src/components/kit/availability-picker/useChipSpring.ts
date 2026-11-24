// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import { animate } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { useStill } from "../env";
import { pickerMotion } from "./pickerMotion";

/**
 * Moves the caption under the active orb. Its left edge and width are two
 * numbers, `--ap-chip-x` and `--ap-chip-w`, that the sheet turns into a
 * translation and a size. A spring moves them, because it is spatial movement;
 * the first place, a new width at the same stop, reduced motion and the test
 * runner place them at once.
 */
export function useChipSpring(place: { x: number; w: number }, stop: number) {
  const chip = useRef<HTMLSpanElement>(null);
  // The stop the caption was last placed at. A measurement that lands after
  // the pill has opened changes the width but not the stop, and is not glided.
  const placedAt = useRef<number | null>(null);
  const still = useStill();

  useLayoutEffect(() => {
    const node = chip.current;
    if (!node) return;
    if (still || placedAt.current === null || placedAt.current === stop) {
      node.style.setProperty("--ap-chip-x", String(place.x));
      node.style.setProperty("--ap-chip-w", String(place.w));
      placedAt.current = stop;
      return;
    }
    placedAt.current = stop;
    const controls = animate(
      node,
      { "--ap-chip-x": place.x, "--ap-chip-w": place.w },
      { type: "spring", ...pickerMotion.spring },
    );
    return () => {
      controls.stop();
    };
  }, [place.x, place.w, stop, still]);

  return chip;
}
