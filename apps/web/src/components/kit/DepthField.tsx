// Kit: React Bits Pro / hero-21 (aurora field with a glowing orb), rebuilt on WebGL2 without three. Licence: React Bits Pro licence. Adapted to OrderPilot's tokens.
import { useRef, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { GlCanvas } from "./canvas/GlCanvas";
import { useTokenRgb } from "./canvas/useTokenRgb";

interface DepthFieldProps {
  /** The pointer over the frame, -1 to 1 on each axis: layers shift by depth. */
  pointer?: RefObject<{ x: number; y: number }>;
  /** Holds the picture still on request: a person's Pause button. */
  paused?: boolean;
  /** The CSS custom properties that hold the ink, the glow and the sky. */
  tokens: readonly [string, string, string];
  className?: string;
}

// One screen of depth in four planes: curtains of light (hero-21's flowing
// noise, folded to 2D), three layers of stars that shift against each other, a
// perspective grid receding to the horizon, and a planet with a ring and a
// small light on it. The stars and the ring are Spectra's own; the noise is
// Ashima's simplex, as in Aurora.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform vec3 uInk;
uniform vec3 uGlow;
uniform vec3 uSky;
out vec4 outColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.03 + vec2(13.7, 7.3);
    a *= 0.5;
  }
  return v;
}

// One layer of stars: a point in each cell, twinkling slowly.
float stars(vec2 p, float scale, float seed, float size) {
  vec2 q = p * scale;
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  float r = hash(id + seed);
  vec2 o = vec2(hash(id + seed + 7.1), hash(id + seed + 3.7)) - 0.5;
  float d = length(f - o * 0.7);
  float tw = 0.65 + 0.35 * sin(uTime * (0.6 + r * 1.4) + r * 40.0);
  return step(0.82, r) * smoothstep(size, 0.0, d) * tw;
}

void main() {
  vec2 res = uResolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;
  float t = uTime;
  float horizon = -0.1;
  vec3 col = uInk;

  // Curtains of light, shifted a little by the pointer.
  vec2 fp = p + uPointer * 0.02;
  vec2 flow = fp;
  flow.x += sin(flow.y * 2.1 + t * 0.07) * 0.17;
  flow.y += cos(flow.x * 2.5 - t * 0.06) * 0.12;
  float cloud = fbm(flow * 1.5 + vec2(t * 0.012, 0.0));
  float ribbon = sin((flow.y + cloud * 0.4) * 7.0 + flow.x * 2.6 - t * 0.22);
  float curtain = smoothstep(0.05, 0.95, ribbon * 0.5 + 0.5) * smoothstep(-0.2, 0.7, cloud);
  float above = smoothstep(horizon - 0.05, 0.45, p.y);
  col += mix(uGlow, uSky, smoothstep(-0.4, 0.5, p.x + cloud * 0.3)) * curtain * above * 0.42;

  // Three layers of stars, nearest drifting fastest and following the pointer most.
  float dust = stars(p + uPointer * 0.015 + vec2(t * 0.004, 0.0), 22.0, 1.0, 0.07)
             + stars(p + uPointer * 0.03 + vec2(t * 0.008, 0.0), 14.0, 5.0, 0.09) * 1.1
             + stars(p + uPointer * 0.06 + vec2(t * 0.014, 0.0), 8.0, 9.0, 0.1) * 1.3;
  col += mix(uSky, vec3(1.0), 0.55) * dust * smoothstep(horizon, horizon + 0.25, p.y) * 0.9;

  // The planet, ring and glow at the horizon.
  vec2 c = vec2(uPointer.x * 0.012, horizon + 0.2);
  vec2 q = p - c;
  float rad = 0.17;
  float disc = smoothstep(rad, rad - 0.004, length(q));
  vec2 n2 = q / rad;
  float zz = sqrt(max(0.0, 1.0 - dot(n2, n2)));
  float rim = pow(1.0 - zz, 3.0);
  vec3 body = uInk * 0.5 + mix(uGlow, uSky, 0.4) * (0.05 + 0.5 * max(0.0, dot(vec3(n2, zz), normalize(vec3(-0.5, 0.65, 0.55)))) * 0.45);
  float band = 0.5 + 0.5 * sin(n2.y * 9.0 + cloud * 2.0);
  body += uGlow * band * 0.05;
  col = mix(col, body + uGlow * rim * 0.9, disc);
  col += uGlow * pow(smoothstep(0.5, rad, length(q)), 2.0) * 0.16;

  // The ring: an ellipse, its far half hidden behind the planet. A light runs on it.
  vec2 e = vec2(q.x / 0.4, q.y / 0.085);
  float ring = smoothstep(0.03, 0.0, abs(length(e) - 1.0));
  float behind = step(0.0, q.y) * disc;
  col += mix(uGlow, uSky, 0.5) * ring * (1.0 - behind) * 0.6;
  float a = t * 0.45;
  vec2 lamp = vec2(0.4 * cos(a), 0.085 * sin(a));
  float lampSeen = (lamp.y < 0.0 || length(lamp) > rad) ? 1.0 : 0.25;
  col += vec3(1.0) * (0.0009 / (dot(q - lamp, q - lamp) + 0.0009)) * 0.7 * lampSeen;

  // The floor: a grid in perspective that slides toward the viewer.
  float d = horizon - p.y;
  if (d > 0.0) {
    float depth = 0.32 / d;
    float gx = (p.x + uPointer.x * 0.05) * depth * 2.2;
    float gz = depth - t * 0.35;
    vec2 g = vec2(gx, gz);
    vec2 w = fwidth(g);
    vec2 line = smoothstep(w * 1.6, vec2(0.0), abs(fract(g - 0.5) - 0.5));
    float grid = max(line.x, line.y);
    float fade = exp(-d * 7.0) * 0.9 + 0.05;
    col = mix(col, uInk * 0.7, 0.35);
    col += mix(uGlow, uSky, smoothstep(-1.0, 1.0, p.x)) * grid * fade * 0.75;
  }
  col += uGlow * exp(-abs(p.y - horizon) * 14.0) * 0.45;

  float vign = smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.35)));
  col *= 0.45 + 0.65 * vign;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.012;
  outColor = vec4(col, 1.0);
}`;

/**
 * The live picture of the sign-in stage: curtains of light, three planes of
 * stars, a planet with a ring and a perspective floor, in the page's navy and
 * teal. It is decoration (`aria-hidden`). It moves only while on screen, with
 * the tab showing and not paused, clamps the pixel ratio to 2, and draws one
 * still frame under reduced motion. Where WebGL2 is missing it is a plain
 * gradient of the same colours.
 */
export function DepthField({
  pointer,
  paused = false,
  tokens,
  className,
}: DepthFieldProps) {
  const [ink, glow, sky] = useTokenRgb(tokens);
  const key = [ink, glow, sky].map((c) => c?.join(",") ?? "").join("|");
  const smooth = useRef({ x: 0, y: 0 });
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
        redrawKey={key}
        paused={paused}
        stillTime={24}
        fallback={{
          backgroundImage: `radial-gradient(40% 35% at 50% 62%, color-mix(in srgb, var(${tokens[1]}) 45%, transparent), transparent), radial-gradient(60% 50% at 80% 10%, color-mix(in srgb, var(${tokens[2]}) 30%, transparent), transparent), linear-gradient(var(${tokens[0]}), var(${tokens[0]}))`,
        }}
        draw={(gl, uniform) => {
          // Eased here, once per frame, so the layers glide after the pointer.
          const target = pointer?.current ?? { x: 0, y: 0 };
          const eased = smooth.current;
          eased.x += (target.x - eased.x) * 0.08;
          eased.y += (target.y - eased.y) * 0.08;
          gl.uniform2f(uniform("uPointer"), eased.x, eased.y);
          gl.uniform3fv(uniform("uInk"), ink ?? [0, 0, 0]);
          gl.uniform3fv(uniform("uGlow"), glow ?? [0, 0, 0]);
          gl.uniform3fv(uniform("uSky"), sky ?? [0, 0, 0]);
        }}
      />
    </div>
  );
}
