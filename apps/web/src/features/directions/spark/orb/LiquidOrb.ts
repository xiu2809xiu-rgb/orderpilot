// Source: github.com/LerSent001/orb ("Liquid Orb", WebGPU). Licence: MIT, Copyright (c) 2026 LerSent001
// (the licence text is in LICENSE beside this file). Adapted to OrderPilot: wrapped as a class, the colours
// come from the design tokens instead of fixed palettes, the particle-ribbon pipelines are left out
// (Spark uses the aurora style only), the frame loop can be paused, and failures are reported to the caller.
import shaderSource from "./liquidOrb.wgsl?raw";
import seeds from "./orbSeeds.json";
import { orbColours, type OrbState, type OrbTokens } from "./orbPalette";
import {
  BUFFER_UNIFORM_COPY_DST,
  gpuApi,
  type GpuBindGroup,
  type GpuBuffer,
  type GpuCanvasContext,
  type GpuDevice,
  type GpuRenderPipeline,
} from "./webgpu";

const SEEDS: Record<OrbState, readonly number[]> = seeds;
const ACTIVATION_MS = 220;
const SETTLE_MS = 600;
/** Where a vec4 colour starts in the uniform block, by name. */
const SLOT = {
  a: 40,
  b: 44,
  c: 48,
  d: 52,
  highlight: 56,
  shell: 60,
  canvas: 80,
  glow: 84,
} as const;

const srgbToLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (value: number) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
const mixSrgb = (from: number, to: number, progress: number) =>
  linearToSrgb(
    srgbToLinear(from) + (srgbToLinear(to) - srgbToLinear(from)) * progress,
  );

/** The seed of a state with the design's colours written into it. */
function seedOf(state: OrbState, tokens: OrbTokens): Float32Array {
  const values = new Float32Array(SEEDS[state]);
  const colours = orbColours(tokens, state);
  for (const [name, start] of Object.entries(SLOT)) {
    const rgb = colours[name as keyof typeof colours];
    values.set(rgb, start);
    values[start + 3] = 1;
  }
  return values;
}

/**
 * The WebGPU liquid orb on one canvas. `create` returns null where the browser
 * has no WebGPU or no adapter, so the caller can draw the WebGL orb instead.
 * It never draws while `setRunning(false)`, so an orb that is off screen or in
 * a hidden tab costs nothing. The pixel ratio is clamped to 2.
 */
export class LiquidOrb {
  private frameId = 0;
  private running = false;
  private destroyed = false;
  private lastFrameAt: number | null = null;
  private motionPhase = 0;
  private state: OrbState = "idle";
  private tokens: OrbTokens;
  private from: Float32Array;
  private target: Float32Array;
  private readonly displayed: Float32Array;
  private readonly values: Float32Array;
  private startedAt = 0;
  private duration = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GpuDevice,
    private readonly context: GpuCanvasContext,
    private readonly pipeline: GpuRenderPipeline,
    private readonly bindGroup: GpuBindGroup,
    private readonly uniformBuffer: GpuBuffer,
    tokens: OrbTokens,
    private readonly onFail: (reason: string) => void,
  ) {
    this.tokens = tokens;
    this.from = seedOf("idle", tokens);
    this.target = this.from;
    this.displayed = new Float32Array(this.from);
    this.values = new Float32Array(this.from);
  }

  static async create(
    canvas: HTMLCanvasElement,
    tokens: OrbTokens,
    onFail: (reason: string) => void,
  ): Promise<LiquidOrb | null> {
    const gpu = gpuApi();
    if (!gpu) return null;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext(
      "webgpu",
    ) as unknown as GpuCanvasContext | null;
    if (!context) {
      device.destroy();
      return null;
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "premultiplied" });
    const shader = device.createShaderModule({ code: shaderSource });
    const info = await shader.getCompilationInfo();
    const errors = info.messages.filter((message) => message.type === "error");
    if (errors.length > 0) {
      device.destroy();
      return null;
    }
    const over = {
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
      operation: "add",
    };
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs_main" },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{ format, blend: { color: over, alpha: over } }],
      },
      primitive: { topology: "triangle-list" },
    });
    const uniformBuffer = device.createBuffer({
      size: SEEDS.idle.length * 4,
      usage: BUFFER_UNIFORM_COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    const orb = new LiquidOrb(
      canvas,
      device,
      context,
      pipeline,
      bindGroup,
      uniformBuffer,
      tokens,
      onFail,
    );
    void device.lost.then((lost) => {
      orb.fail(lost.message ?? lost.reason ?? "device lost");
    });
    device.addEventListener("uncapturederror", (event) => {
      event.preventDefault();
      orb.fail(event.error.message);
    });
    return orb;
  }

  /** The colours changed (the scheme): repaint in them. */
  setTokens(tokens: OrbTokens) {
    this.tokens = tokens;
    this.from = seedOf(this.state, tokens);
    this.target = this.from;
    this.duration = 0;
  }

  setState(next: OrbState) {
    if (next === this.state) return;
    const now = performance.now();
    this.sample(now);
    this.from = new Float32Array(this.displayed);
    this.target = seedOf(next, this.tokens);
    this.startedAt = now;
    this.duration = next === "thinking" ? ACTIVATION_MS : SETTLE_MS;
    this.state = next;
  }

  setRunning(run: boolean) {
    if (this.destroyed || run === this.running) return;
    this.running = run;
    if (run) {
      this.lastFrameAt = null;
      this.frameId = requestAnimationFrame(this.frame);
    } else {
      cancelAnimationFrame(this.frameId);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.frameId);
    this.uniformBuffer.destroy();
    this.context.unconfigure();
    this.device.destroy();
  }

  private fail(reason: string) {
    if (this.destroyed) return;
    this.destroy();
    this.onFail(reason);
  }

  private progress(now: number) {
    if (this.duration === 0) return 1;
    const raw = Math.min(
      1,
      Math.max(0, (now - this.startedAt) / this.duration),
    );
    return this.state === "thinking"
      ? 1 - (1 - raw) ** 3
      : raw * raw * (3 - 2 * raw);
  }

  private sample(now: number) {
    const progress = this.progress(now);
    for (let index = 3; index < this.displayed.length; index += 1) {
      const from = this.from[index] ?? 0;
      const to = this.target[index] ?? 0;
      const colour = index >= 40 && (index - 40) % 4 < 3;
      this.displayed[index] = colour
        ? mixSrgb(from, to, progress)
        : from + (to - from) * progress;
    }
  }

  private readonly frame = (now: number) => {
    if (!this.running) return;
    try {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.sample(now);
      this.values.set(this.displayed);
      const delta =
        this.lastFrameAt === null
          ? 0
          : Math.min(0.1, Math.max(0, (now - this.lastFrameAt) / 1000));
      this.lastFrameAt = now;
      const speed = Math.max(this.values[3] ?? 0, 0);
      this.motionPhase += delta * speed;
      this.values[0] = width;
      this.values[1] = height;
      this.values[2] = this.motionPhase / Math.max(speed, 0.001);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, this.values);
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.draw(3);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      this.frameId = requestAnimationFrame(this.frame);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  };
}
