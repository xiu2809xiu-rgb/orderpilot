import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  prefersReducedMotion,
  useLatest,
  useOnScreen,
  useTabVisible,
} from "../env";

type Uniform = (name: string) => WebGLUniformLocation | null;

interface GlCanvasProps {
  /** A GLSL ES 3.00 fragment shader. It may read `uResolution` and `uTime`. */
  fragment: string;
  /** Sets this frame's uniforms. `time` is in seconds. */
  draw: (gl: WebGL2RenderingContext, uniform: Uniform, time: number) => void;
  /** Changes when the picture must be redrawn while it is still (colours). */
  redrawKey?: string;
  /** The time a still picture is drawn at: a frame with something in it. */
  stillTime?: number;
  /** Shown where WebGL2 is missing (and in tests): plain CSS, no script. */
  fallback: CSSProperties;
  className?: string;
}

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, fragment: string) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vertex || !frag) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(frag);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

/**
 * The one canvas behind the full-screen shaders (Dither, Aurora). It draws a
 * single triangle that covers the canvas and lets the shader do the rest. It
 * only animates while it is on screen and the tab is showing, clamps the
 * device pixel ratio to 2, and draws one still frame under reduced motion.
 * Where there is no WebGL2 (an old browser, the test runner) it renders the
 * plain CSS fallback instead, and never throws.
 */
export function GlCanvas({
  fragment,
  draw,
  redrawKey = "",
  stillTime = 6,
  fallback,
  className,
}: GlCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onScreen = useOnScreen(ref);
  const tabVisible = useTabVisible();
  const [failed, setFailed] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const latest = useLatest(draw);
  const render = useRef<((time: number) => void) | null>(null);
  const time = useRef(stillTime);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false });
    const program = gl ? link(gl, fragment) : null;
    if (!gl || !program) {
      setFailed(true);
      return;
    }
    const locations = new Map<string, WebGLUniformLocation | null>();
    const uniform: Uniform = (name) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    };
    render.current = (seconds) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform2f(uniform("uResolution"), width, height);
      gl.uniform1f(uniform("uTime"), seconds);
      latest.current(gl, uniform, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    render.current(time.current);
    const observer = new ResizeObserver(() => {
      render.current?.(time.current);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      render.current = null;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [fragment, latest]);

  // Still picture: redraw when the colours change.
  useEffect(() => {
    render.current?.(time.current);
  }, [redrawKey]);

  const running = onScreen && tabVisible && !reduced && !failed;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      time.current += Math.min(0.05, (now - last) / 1000);
      last = now;
      render.current?.(time.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [running]);

  if (failed) {
    return (
      <div
        aria-hidden="true"
        data-fallback=""
        className={cn("absolute inset-0", className)}
        style={fallback}
      />
    );
  }
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("absolute inset-0 size-full", className)}
    />
  );
}
