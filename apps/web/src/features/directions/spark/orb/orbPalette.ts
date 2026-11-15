import { useMemo } from "react";
import { useTokenRgb } from "@/components/kit/canvas/useTokenRgb";

export type Rgb = readonly [number, number, number];

/** The tokens the orb is coloured from, as 0 to 1 triples. */
export interface OrbTokens {
  /** The panel behind the orb. */
  ground: Rgb;
  /** The accent: teal. */
  accent: Rgb;
  /** The information colour, a second hue to blend towards. */
  info: Rgb;
  /** The text colour: the light that the highlights are tinted from. */
  ink: Rgb;
}

export type OrbState = "idle" | "thinking";

const mix = (a: Rgb, b: Rgb, amount: number): Rgb => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
  a[2] + (b[2] - a[2]) * amount,
];
const BLACK: Rgb = [0.01, 0.015, 0.03];
const WHITE: Rgb = [1, 1, 1];

/** The orb's tokens, read again when the scheme changes. */
export function useOrbTokens(): OrbTokens {
  const [ground, accent, info, ink] = useTokenRgb([
    "--popover",
    "--ring",
    "--info",
    "--foreground",
  ]);
  // One object until a token really changes, so the orb is not repainted (and
  // a colour change in flight is not cut short) on every render.
  return useMemo(
    () => ({
      ground: ground ?? BLACK,
      accent: accent ?? WHITE,
      info: info ?? WHITE,
      ink: ink ?? WHITE,
    }),
    [ground, accent, info, ink],
  );
}

/**
 * The colours of the orb in one state. Idle is the accent held low over a deep
 * body; thinking brings the accent up, blends in the information hue and
 * lights the highlights. Both come from the design tokens. The body is a deep tone of the accent in
 * every scheme: the orb is a lit glass, not a patch of the panel.
 */
export function orbColours(tokens: OrbTokens, state: OrbState) {
  const { accent, info, ink } = tokens;
  const body = mix(BLACK, accent, 0.07);
  if (state === "idle") {
    return {
      a: body,
      b: mix(body, accent, 0.62),
      c: mix(accent, info, 0.45),
      d: mix(body, info, 0.5),
      highlight: mix(accent, WHITE, 0.55),
      shell: mix(accent, WHITE, 0.3),
      canvas: mix(BLACK, accent, 0.05),
      glow: accent,
    };
  }
  return {
    a: body,
    b: mix(accent, WHITE, 0.1),
    c: mix(accent, info, 0.55),
    d: mix(info, BLACK, 0.45),
    highlight: mix(ink, WHITE, 0.5),
    shell: mix(accent, WHITE, 0.45),
    canvas: mix(BLACK, accent, 0.05),
    glow: mix(accent, WHITE, 0.15),
  };
}

const luminance = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * What the WebGL orb is drawn with. Its ring is light on a dark ground, so on
 * a light panel it would wash out to grey. There it sits on a deep disc of the
 * text colour, which is also how the WebGPU orb looks on a light
 * panel: a dark lit glass, not a ring on white.
 */
export function webglLook(tokens: OrbTokens, state: OrbState) {
  const { b, c, d, canvas } = orbColours(tokens, state);
  return {
    colours: [b, c, d] as const,
    ground: canvas,
    disc: luminance(tokens.ground) >= 0.5,
  };
}
