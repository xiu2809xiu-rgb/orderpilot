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
 * section 8); the one spring, which grows the pill and glides the caption, is
 * spatial movement and may run longer.
 */
export const pickerMotion = {
  /** The pill grows out of its trigger, and the caption glides, on the token spring (--spring-stiffness, --spring-damping). */
  spring: { stiffness: 260, damping: 28 },
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

/** The pill's boxes in CSS px: a fine pointer gets a caption, a finger gets words under the orbs. */
export const pillGeometry = {
  orb: 44,
  pad: 8,
  gap: 8,
  fine: { width: 164, height: 94 },
  coarse: { width: 264, height: 96 },
  chip: { height: 28, minWidth: 72, padX: 24, inset: 4 },
} as const;

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

/** How long the growth runs, in ms: the time the token spring needs to settle. */
export const GROW_MS = Math.round(
  settleSeconds(pickerMotion.spring.stiffness, pickerMotion.spring.damping) *
    1000,
);

/** The easing the sheet reads as --ap-spring. */
export const GROW_EASING = springEasing(
  pickerMotion.spring.stiffness,
  pickerMotion.spring.damping,
);

/** Where the caption sits under the active orb: its left edge and width, in CSS px. */
export function chipPlace(
  index: number,
  wordWidth: number,
  pillWidth: number = pillGeometry.fine.width,
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
