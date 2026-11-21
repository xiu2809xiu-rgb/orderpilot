// Kit: React Bits / Aurora. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { cn } from "@/lib/utils";
import { GlCanvas } from "./canvas/GlCanvas";
import { useTokenRgb } from "./canvas/useTokenRgb";

interface AuroraProps {
  /** How far down the curtain reaches, 0 to 1. */
  height?: number;
  /** Overall strength, 0 to 1. Keep it lower on a light scheme. */
  opacity?: number;
  /** Holds the curtains still: a person's Pause button. */
  paused?: boolean;
  className?: string;
}

// Three layers of simplex-noise curtains that rise from the top edge, tinted
// along their width by three colours. Premultiplied output, so the page's own
// ground shows through. The noise is Ashima's simplex, as in the source item.
const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uStops[3];
uniform float uHeight;
uniform float uOpacity;
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
float smoother(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(uStops[0], uStops[1], smoothstep(0.0, 0.5, t))
                 : mix(uStops[1], uStops[2], smoothstep(0.5, 1.0, t));
}

void main() {
  float y = 1.0 - gl_FragCoord.y / uResolution.y;
  float u = gl_FragCoord.x / uResolution.x;
  float X = (gl_FragCoord.x - uResolution.x * 0.5) / uResolution.y;
  vec3 glow = vec3(0.0);
  float cover = 0.0;
  for (int k = 0; k < 3; k++) {
    float layer = float(k);
    float seed = layer * 13.7;
    float pace = uTime * (1.0 - layer * 0.18);
    float warp = snoise(vec2(X * 0.45 + pace * 0.02 + seed, pace * 0.05 + seed));
    float wave = snoise(vec2(X * 0.75 + warp * 0.35 - pace * 0.03 + seed, pace * 0.07 - seed)) * 0.72
               + snoise(vec2(X * 1.6 + warp * 0.5 + pace * 0.04 - seed, pace * 0.1 + seed * 0.5)) * 0.28;
    float hem = uHeight + layer * 0.07 + wave * 0.18;
    float soft = 0.17 * (1.0 + layer * 0.9);
    float body = pow(smoother(-soft, 0.3 + soft * 0.6, hem - y), 1.6);
    float alpha = body * (layer < 0.5 ? 1.0 : 0.34 / layer);
    vec3 tint = ramp(u + 0.05 * sin(pace * 0.08 + layer * 2.3) + layer * 0.1);
    glow = 1.0 - (1.0 - glow) * (1.0 - tint * alpha);
    cover = 1.0 - (1.0 - cover) * (1.0 - alpha);
  }
  outColor = vec4(glow * uOpacity, cover * uOpacity);
}`;

/**
 * Spectra's sign-in ground: soft curtains of light in teal, sky and indigo that
 * drift slowly down from the top edge. It moves only while on screen and the
 * tab is showing, and holds one still frame under reduced motion. Where WebGL2
 * is missing it falls back to three blurred gradients of the same colours. It
 * is decoration (`aria-hidden`); the form sits on a glass card above it.
 */
export function Aurora({
  height = 0.62,
  opacity = 0.9,
  paused = false,
  className,
}: AuroraProps) {
  const stops = useTokenRgb(["--ring", "--info", "--primary"]);
  const [a, b, c] = stops;
  const key = stops.map((s) => s.join(",")).join("|");
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
        fallback={{
          backgroundImage:
            "radial-gradient(60% 50% at 20% 0%, color-mix(in srgb, var(--ring) 55%, transparent), transparent), radial-gradient(50% 45% at 60% 0%, color-mix(in srgb, var(--info) 45%, transparent), transparent), radial-gradient(45% 40% at 95% 5%, color-mix(in srgb, var(--primary) 40%, transparent), transparent)",
        }}
        draw={(gl, uniform) => {
          const flat = [
            ...(a ?? [0, 0, 0]),
            ...(b ?? [0, 0, 0]),
            ...(c ?? [0, 0, 0]),
          ];
          gl.uniform3fv(uniform("uStops"), flat);
          gl.uniform1f(uniform("uHeight"), height);
          gl.uniform1f(uniform("uOpacity"), opacity);
        }}
      />
    </div>
  );
}
