/** Colour maths for the direction tokens: the token test and the kit sheet share it. */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Tokens = Record<string, string>;

/** A token that must exist: a missing one is a bug in the caller. */
export function need(t: Tokens, name: string): string {
  const value = t[name];
  if (value === undefined) throw new Error(`Missing token --${name}`);
  return value;
}

export function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const digits = hex[1] ?? "000000";
    const full =
      digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn =
    /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/.exec(
      value,
    );
  if (fn) {
    return {
      r: Number(fn[1]),
      g: Number(fn[2]),
      b: Number(fn[3]),
      a: fn[4] === undefined ? 1 : Number(fn[4]),
    };
  }
  throw new Error(`Not a colour: ${value}`);
}

export function flatten(top: Rgba, under: Rgba): Rgba {
  const mix = (a: number, b: number) => a * top.a + b * (1 - top.a);
  return {
    r: mix(top.r, under.r),
    g: mix(top.g, under.g),
    b: mix(top.b, under.b),
    a: 1,
  };
}

export function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** One radial layer of a ground: where it sits, how far it reaches and its colour. */
interface Bloom {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  stop: number;
  colour: Rgba;
}

/**
 * Reads the layers of a `ground-image` written as
 * `radial-gradient(RX% RY% at X% Y%, <colour>, transparent STOP%)`. A layer
 * that is not in that form is a bug in the token file, so it throws.
 */
export function parseBlooms(image: string): Bloom[] {
  if (image.trim() === "none") return [];
  const found = [
    ...image.matchAll(
      /radial-gradient\(\s*([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(#[0-9a-f]{6}|rgb\([^)]*\))\s*,\s*transparent\s+([\d.]+)%\s*\)/gi,
    ),
  ];
  const count = image.split("radial-gradient(").length - 1;
  if (found.length !== count) {
    throw new Error(`A ground layer is not a plain radial gradient: ${image}`);
  }
  return found.map((m) => ({
    rx: Number(m[1]) / 100,
    ry: Number(m[2]) / 100,
    cx: Number(m[3]) / 100,
    cy: Number(m[4]) / 100,
    colour: parseColor(m[5] ?? ""),
    stop: Number(m[6]) / 100,
  }));
}

/** The ground at one point of the window (x and y from 0 to 1), layers stacked in paint order. */
export function groundAt(t: Tokens, blooms: Bloom[], x: number, y: number) {
  let colour = parseColor(need(t, "background"));
  // The first layer is painted on top, so lay down the last one first.
  for (const b of [...blooms].reverse()) {
    const d = Math.hypot((x - b.cx) / b.rx, (y - b.cy) / b.ry);
    const fade = Math.max(0, 1 - d / b.stop);
    colour = flatten({ ...b.colour, a: b.colour.a * fade }, colour);
  }
  return colour;
}

/** A part of the window, as fractions from the top left. */
export interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const WHOLE_WINDOW: Region = { x0: 0, x1: 1, y0: 0, y1: 1 };

/**
 * The worst ground a surface can sit on: sampled across a 1440 by 900 window
 * (or a part of it), the brightest point for a dark scheme (light text) and
 * the darkest for a light one (dark text). The mesh is
 * `background-attachment: fixed`, so this is exactly what is behind a panel
 * wherever it is placed.
 */
export function worstGround(t: Tokens, region: Region = WHOLE_WINDOW): Rgba {
  const base = parseColor(need(t, "background"));
  const blooms = parseBlooms(t["ground-image"] ?? "none");
  if (blooms.length === 0) return base;
  const dark = luminance(base) < 0.4;
  let worst = base;
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const here = groundAt(
        t,
        blooms,
        region.x0 + ((region.x1 - region.x0) * i) / steps,
        region.y0 + ((region.y1 - region.y0) * j) / steps,
      );
      const lum = luminance(here);
      if (dark ? lum > luminance(worst) : lum < luminance(worst)) worst = here;
    }
  }
  return worst;
}

/** A chain such as ["accent", "card"] is accent drawn over card over the ground. */
export function surface(t: Tokens, chain: string[]): Rgba {
  let colour = worstGround(t);
  for (const name of [...chain].reverse()) {
    colour = flatten(parseColor(need(t, name)), colour);
  }
  return colour;
}

/** A colour as the kit sheet prints it: "#2ee6d6", or "#2ee6d6 at 14%" when it is translucent. */
export function describeColour(value: string): string {
  const { r, g, b, a } = parseColor(value);
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return a < 1 ? `${hex} at ${String(Math.round(a * 100))}%` : hex;
}
