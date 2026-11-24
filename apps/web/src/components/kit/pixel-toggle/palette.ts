/** Math helpers and the toggle's own night and day colours. */

export const TURN = Math.PI * 2;

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));
export const mix = (from: number, to: number, fraction: number): number =>
  from + (to - from) * fraction;
export const wrap = (value: number, period: number): number =>
  ((value % period) + period) % period;

export type Rgb = readonly [number, number, number];

export function parseColor(hex: string): Rgb {
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

/** Blends two colours: 0 is `a`, 1 is `b`. */
export function blend(a: Rgb, b: Rgb, time: number): Rgb {
  return [
    Math.round(mix(a[0], b[0], time)),
    Math.round(mix(a[1], b[1], time)),
    Math.round(mix(a[2], b[2], time)),
  ];
}

export const rgba = (color: Rgb, alpha = 1): string =>
  `rgba(${color.join(",")},${String(alpha)})`;

/**
 * The toggle's own palette, [night, day]. It is the component's identity, so
 * nothing else in the app takes these colours. pixelToggle.css repeats the two
 * ends for the first paint, and a test keeps the two copies equal. The
 * supplied bundle also had a scene background, a halo and a focus colour: the
 * switch now sits on the bar, which draws its own ground, and the focus ring
 * is the app's.
 */
export const PALETTE = {
  "track-top": ["09090a", "dededd"],
  "track-bottom": ["0d0d0e", "ebebea"],
  "track-inset": ["000000", "bdbdba"],
  "track-light": ["1a1a1d", "ffffff"],
  "track-edge": ["242426", "f3f3f2"],
  "track-shadow": ["000000", "9d9b96"],
  "knob-top": ["53535b", "ffffff"],
  "knob-bottom": ["282831", "eeede9"],
  "knob-rim": ["ffffff", "ffffff"],
  "knob-shadow": ["000000", "7c7b77"],
} as const satisfies Record<string, readonly [string, string]>;

export type PaletteName = keyof typeof PALETTE;

/** Translucent entries: [alpha at night, alpha by day]. */
export const ALPHA: Partial<Record<PaletteName, readonly [number, number]>> = {
  "knob-top": [0.5, 0.94],
  "knob-bottom": [0.42, 0.88],
  "knob-rim": [0.27, 0.62],
  "knob-shadow": [0.44, 0.35],
};

export const MOON_LIGHT: Rgb = [111, 134, 255];
export const SUN_LIGHT: Rgb = [255, 168, 46];

const NAMES = Object.keys(PALETTE) as PaletteName[];

/** The custom properties of the button for a theme: 0 is night, 1 is day. */
export function paletteVariables(theme: number): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const name of NAMES) {
    const [night, day] = PALETTE[name];
    const alpha = ALPHA[name];
    variables[`--pt-${name}`] = rgba(
      blend(parseColor(night), parseColor(day), theme),
      alpha ? mix(alpha[0], alpha[1], theme) : 1,
    );
  }
  return variables;
}
