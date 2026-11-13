// Kit: React Bits / Dither. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { cn } from "@/lib/utils";
import { GlCanvas } from "./canvas/GlCanvas";
import { useTokenRgb } from "./canvas/useTokenRgb";

interface DitherProps {
  /** Size of one dither cell, in device pixels. */
  cell?: number;
  /** How much of the field is inked, 0 to 1. Keep it low behind a form. */
  strength?: number;
  className?: string;
}

// Warped noise, cut to a two-tone picture by a 4 by 4 ordered (Bayer) matrix:
// the look of a plotted field. Premultiplied output, so the page shows through.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;
uniform float uStrength;
uniform vec3 uInk;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 uv = cell * uCell / uResolution.y;
  float t = uTime * 0.04;
  float n = fbm(uv * 3.2 + fbm(uv * 2.0 - t) + t);
  // Quieter on the left, where the form sits.
  float side = smoothstep(0.0, 1.0, cell.x * uCell / uResolution.x);
  float level = (n - 0.32) * 1.9 * uStrength * (0.35 + 0.65 * side);
  int ix = int(mod(cell.x, 4.0));
  int iy = int(mod(cell.y, 4.0));
  float threshold = (BAYER[iy * 4 + ix] + 0.5) / 16.0;
  float on = step(threshold, level);
  outColor = vec4(uInk * on, on);
}`;

/**
 * Ink's sign-in ground: a slow field of noise, drawn as ordered dither in the
 * accent colour at low strength. The field drifts only while it is on screen
 * and the tab is showing, and holds one still frame under reduced motion.
 * Where WebGL2 is missing it falls back to a plain dotted gradient. It is
 * decoration (`aria-hidden`) and sits behind the form, never under body text
 * that needs contrast: keep the form on its own surface.
 */
export function Dither({ cell = 3, strength = 0.7, className }: DitherProps) {
  const [ink] = useTokenRgb(["--ring"]);
  const rgb = ink ?? [0.5, 0.5, 0.5];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <GlCanvas
        fragment={FRAGMENT}
        redrawKey={rgb.join(",")}
        fallback={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--ring) 45%, transparent) 1px, transparent 1.5px)",
          backgroundSize: "6px 6px",
          maskImage: "linear-gradient(90deg, transparent, #000)",
        }}
        draw={(gl, uniform) => {
          gl.uniform1f(
            uniform("uCell"),
            cell * Math.min(window.devicePixelRatio || 1, 2),
          );
          gl.uniform1f(uniform("uStrength"), strength);
          gl.uniform3f(uniform("uInk"), rgb[0], rgb[1], rgb[2]);
        }}
      />
    </div>
  );
}
