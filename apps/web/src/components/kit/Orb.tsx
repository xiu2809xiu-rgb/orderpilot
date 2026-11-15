// Kit: React Bits / Orb. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./env";
import { ORB_FRAGMENT, ORB_VERTEX } from "./orbGl.shader";

export type Rgb = readonly [number, number, number];

interface OrbProps {
  /** The three colours of the orb, as 0 to 1 triples read from the tokens. */
  colours: readonly [Rgb, Rgb, Rgb];
  /** The colour of the panel behind the orb. */
  ground: Rgb;
  /** Spark is working: the swirl runs faster and the body glows. */
  thinking?: boolean;
  /** Called once if WebGL2 is missing, so the caller can draw the still orb. */
  onUnavailable?: () => void;
  className?: string;
}

const UNIFORMS = [
  "uResolution",
  "uTime",
  "uRotation",
  "uReach",
  "uNear",
  "uAwake",
  "uBackground",
  "uColor1",
  "uColor2",
  "uColor3",
  "uScale",
  "uWobble",
  "uGlow",
  "uBleed",
  "uHighlight",
  "uSwirl",
  "uOrbit",
  "uEcho",
  "uReveal",
  "uOpacity",
  "uTrail",
  "uTilt",
] as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, ORB_VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, ORB_FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

/**
 * The WebGL2 orb: a glowing ring that swirls, with a light that orbits it.
 * Spark uses it where WebGPU is missing. It reads its colours from the caller
 * (the design tokens), clamps the pixel ratio to 2, stops while it is off
 * screen or the tab is hidden, and under reduced motion draws one frame. The
 * pointer effects of the original (hover reach, click pulse) are left out: the
 * orb is a status light, not a toy. It never throws: with no WebGL2 it calls
 * `onUnavailable` and draws nothing.
 */
export function Orb({
  colours,
  ground,
  thinking = false,
  onUnavailable,
  className,
}: OrbProps) {
  const holder = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ colours, ground, thinking });
  const redraw = useRef<(() => void) | null>(null);
  const unavailable = useRef(onUnavailable);

  useEffect(() => {
    latest.current = { colours, ground, thinking };
    redraw.current?.();
  });
  useEffect(() => {
    unavailable.current = onUnavailable;
  });

  useEffect(() => {
    const holderEl = holder.current;
    const canvas = canvasRef.current;
    if (!holderEl || !canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    const program = gl ? link(gl) : null;
    if (!gl || !program) {
      unavailable.current?.();
      return;
    }
    const locations = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const reduced = prefersReducedMotion();
    const state = { time: 3, swirl: 0, orbit: 0, awake: 0, kick: 0 };
    let raf = 0;
    let last = 0;
    let visible = true;

    const draw = () => {
      const { colours: palette, ground: back } = latest.current;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(locations.uResolution ?? null, canvas.width, canvas.height);
      gl.uniform1f(locations.uTime ?? null, state.time);
      gl.uniform1f(locations.uRotation ?? null, 0);
      gl.uniform2f(locations.uReach ?? null, 0, 0);
      gl.uniform1f(locations.uNear ?? null, 0);
      gl.uniform1f(locations.uAwake ?? null, state.awake * 0.18);
      gl.uniform3fv(locations.uBackground ?? null, back);
      gl.uniform3fv(locations.uColor1 ?? null, palette[0]);
      gl.uniform3fv(locations.uColor2 ?? null, palette[1]);
      gl.uniform3fv(locations.uColor3 ?? null, palette[2]);
      gl.uniform1f(locations.uScale ?? null, 1);
      gl.uniform1f(locations.uWobble ?? null, 1);
      gl.uniform1f(locations.uGlow ?? null, 1);
      gl.uniform1f(locations.uBleed ?? null, 1);
      gl.uniform1f(locations.uHighlight ?? null, 1);
      gl.uniform1f(locations.uSwirl ?? null, state.swirl);
      gl.uniform1f(locations.uOrbit ?? null, state.orbit);
      gl.uniform2f(locations.uEcho ?? null, 0.55, 0);
      gl.uniform1f(locations.uReveal ?? null, 1);
      gl.uniform1f(locations.uOpacity ?? null, 1);
      gl.uniform1f(locations.uTrail ?? null, 1);
      gl.uniform2f(locations.uTilt ?? null, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last
        ? Math.min(0.05, Math.max(0.0005, (now - last) / 1000))
        : 1 / 60;
      last = now;
      const working = latest.current.thinking;
      state.awake +=
        ((working ? 1 : 0) - state.awake) * (1 - Math.exp(-dt / 0.2));
      state.kick +=
        ((working ? 1.6 : 0) - state.kick) * (1 - Math.exp(-dt / 0.3));
      const step = dt * (working ? 1.5 : 1);
      state.time += step;
      state.swirl += step * 2 * (1 + state.kick);
      state.orbit -= step;
      draw();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!reduced && !raf && visible && !document.hidden) {
        raf = requestAnimationFrame(frame);
      }
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(holderEl.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(holderEl.clientHeight * ratio));
      draw();
      wake();
    };
    const sizeWatcher = new ResizeObserver(resize);
    sizeWatcher.observe(holderEl);
    const screenWatcher =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            if (visible) {
              last = 0;
              wake();
            }
          });
    screenWatcher?.observe(holderEl);
    const onVisibility = () => {
      last = 0;
      wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    redraw.current = () => {
      if (!raf) draw();
    };
    resize();

    return () => {
      cancelAnimationFrame(raf);
      redraw.current = null;
      sizeWatcher.disconnect();
      screenWatcher?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      // The context is not forced to be lost: a development re-mount (StrictMode)
      // gets the same canvas context back, and a lost one draws nothing.
    };
  }, []);

  return (
    <div ref={holder} className={cn("relative size-full", className)}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block size-full"
      />
    </div>
  );
}
