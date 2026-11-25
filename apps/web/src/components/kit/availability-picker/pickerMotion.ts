// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.

/**
 * The picker's numbers. A value that names a design token is read from
 * tokens.css by pickerMotion.test.ts and must equal it; the sheets use the
 * tokens by name, so the numbers here are for the tests, the spring and the
 * parts' own geometry. UI motion stays between 150 and 250 ms (CLAUDE.md
 * section 8); the springs, which grow the pill and glide the caption, are
 * spatial movement and may run longer.
 */
export const pickerMotion = {
  /** The caption glides, and a touch pill grows, on the calm token spring (--spring-stiffness, --spring-damping). */
  spring: { stiffness: 260, damping: 28 },
  /** The pill grows out of its trigger on a fine pointer, and settles a little past its size (--spring-pop-stiffness, --spring-pop-damping). */
  pop: { stiffness: 400, damping: 28 },
  /** The pill folds back into its trigger (--motion-fast). */
  foldMs: 160,
  /** Each orb fades in (--motion-fast), one after another. */
  orbMs: 160,
  orbStaggerMs: 30,
  /** The pulse and the sheen after a pick (--motion-slow). */
  pickMs: 250,
  /** A new caption word fades in (--motion-fast). */
  chipTextMs: 160,
} as const;

/**
 * The pill's border boxes in CSS px: a fine pointer gets a caption, a finger
 * gets words under the orbs. Each box is its content (164 by 94, and 264 by 96)
 * and the 1 px border on each side; a box that left the border out would sit
 * the orbs 2 px off-centre.
 */
export const pillGeometry = {
  orb: 44,
  pad: 8,
  gap: 8,
  border: 1,
  fine: { width: 166, height: 96 },
  coarse: { width: 266, height: 98 },
  chip: { height: 28, minWidth: 72, padX: 24, inset: 4 },
  /** The trigger's box that the pill grows out of: the dot, the ring, and a finger's 44 px. */
  trigger: { dot: 24, ring: 32, touch: 44 },
} as const;

/**
 * How far the pill keeps from the screen's edge, in CSS px: Radix's
 * `collisionPadding`, and the 16 px the touch pill leaves in a narrow screen.
 * The pop spring carries the growing box past its size by a few px, and that
 * must stay inside this gap: pickerMotion.test.ts holds it for the fine pill
 * and shows the touch pill would pass it, which is why a touch pill keeps the
 * calm spring.
 */
export const PILL_EDGE_GAP = 8;

/** The step response of a spring with unit mass, from rest to 1. */
export function springStep(
  stiffness: number,
  damping: number,
  seconds: number,
): number {
  if (seconds <= 0) return 0;
  const natural = Math.sqrt(stiffness);
  const ratio = damping / (2 * natural);
  const decay = ratio * natural;
  const rung = natural * Math.sqrt(1 - ratio * ratio);
  return (
    1 -
    Math.exp(-decay * seconds) *
      (Math.cos(rung * seconds) + (decay / rung) * Math.sin(rung * seconds))
  );
}

/** The seconds after which the spring stays within half a percent of 1. */
export function settleSeconds(stiffness: number, damping: number): number {
  let last = 0;
  for (let at = 0; at < 3; at += 0.005) {
    if (Math.abs(springStep(stiffness, damping, at) - 1) > 0.005) last = at;
  }
  return last + 0.005;
}

const SPRING_SAMPLES = 32;

/**
 * The spring as a CSS `linear()` easing, sampled evenly over the time it takes
 * to settle, so a keyframe animation can use it as its timing function. The
 * last sample is exactly 1.
 */
export function springEasing(stiffness: number, damping: number): string {
  const total = settleSeconds(stiffness, damping);
  const points = Array.from({ length: SPRING_SAMPLES }, (_, i) => {
    const at = ((i + 1) / SPRING_SAMPLES) * total;
    const value =
      i === SPRING_SAMPLES - 1 ? 1 : springStep(stiffness, damping, at);
    return String(Math.round(value * 1000) / 1000);
  });
  return `linear(0, ${points.join(", ")})`;
}

function growth(spring: { stiffness: number; damping: number }) {
  return {
    // The time the spring needs to settle.
    ms: Math.round(settleSeconds(spring.stiffness, spring.damping) * 1000),
    easing: springEasing(spring.stiffness, spring.damping),
  };
}

/** The growth of the pill on a fine pointer, on the pop spring: its duration in ms and the easing the sheet reads as --ap-spring. */
export const GROW_FINE = growth(pickerMotion.pop);

/** The growth of the touch pill, on the calm token spring. */
export const GROW_COARSE = growth(pickerMotion.spring);

/**
 * Where the caption sits under the active orb: its left edge and width, in CSS
 * px, from the pill's padding edge (the caption is positioned inside the
 * border, so `pillWidth` is the padding-box width, 164 by default).
 */
export function chipPlace(
  index: number,
  wordWidth: number,
  pillWidth: number = pillGeometry.fine.width - 2 * pillGeometry.border,
): { x: number; w: number } {
  const { orb, pad, gap, chip } = pillGeometry;
  const w = Math.max(chip.minWidth, Math.ceil(wordWidth) + chip.padX);
  const centre = pad + orb / 2 + index * (orb + gap);
  // Inside the pill, so Radix's collision box is the whole picture.
  const x = Math.min(
    Math.max(centre - w / 2, chip.inset),
    pillWidth - chip.inset - w,
  );
  return { x, w };
}
