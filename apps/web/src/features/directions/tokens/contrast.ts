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

/**
 * The ground a surface can sit on, at its brightest: the base colour with
 * every mesh layer stacked at full strength. A real page is never brighter,
 * so a pair that passes here passes over any part of the mesh.
 */
export function worstGround(t: Tokens): Rgba {
  let colour = parseColor(need(t, "background"));
  const image = t["ground-image"] ?? "none";
  const layers = [
    ...image.matchAll(
      /radial-gradient\([^,]*,\s*(#[0-9a-f]{6}|rgb\([^)]*\))/gi,
    ),
  ];
  for (const layer of layers.reverse()) {
    colour = flatten(parseColor(layer[1] ?? ""), colour);
  }
  return colour;
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
