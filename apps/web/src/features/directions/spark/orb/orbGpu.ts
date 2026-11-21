import shaderSource from "./liquidOrb.wgsl?raw";
import { gpuApi, type GpuDevice, type GpuRenderPipeline } from "./webgpu";

/** What every orb of the page borrows: one device, and the program made on it. */
export interface OrbGpu {
  device: GpuDevice;
  /** The canvas format the program draws to. */
  format: string;
  pipeline: GpuRenderPipeline;
}

type Listener = (reason: string) => void;

let preparing: Promise<OrbGpu | null> | null = null;
let held: OrbGpu | null = null;
const listeners = new Set<Listener>();

const OVER = {
  srcFactor: "one",
  dstFactor: "one-minus-src-alpha",
  operation: "add",
};

/**
 * The page's one GPU program for the orb: the adapter, the device, the shader
 * and the pipeline, made once and kept for the life of the page. Every caller
 * gets the same promise. It resolves to null where WebGPU is missing or
 * anything fails, and the caller draws the WebGL orb instead.
 *
 * The compile takes seconds on a laptop, so the pipeline is made with the
 * asynchronous call: the blocking one holds the GPU process, and every frame
 * of the page with it, until the compiler is done. This module has no React in
 * it so that it can be loaded and started ahead of the first open of Spark.
 */
export function prepareOrbGpu(): Promise<OrbGpu | null> {
  preparing ??= build().catch(() => null);
  return preparing;
}

/**
 * Be told once if the device is lost or hits an error that nobody caught. The
 * store has forgotten the device by then and will not try WebGPU again: the
 * orb that was told draws the WebGL orb. Returns the way to stop listening.
 */
export function onOrbGpuLoss(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forgets the device and tells every orb that borrowed it, once. */
function forget(device: GpuDevice, reason: string) {
  // Our own destroy() below also makes the device report itself lost.
  if (held?.device !== device) return;
  held = null;
  preparing = Promise.resolve(null);
  const told = [...listeners];
  listeners.clear();
  try {
    device.destroy();
  } catch {
    // Already gone: nothing is left to free.
  }
  for (const listener of told) listener(reason);
}

async function build(): Promise<OrbGpu | null> {
  const gpu = gpuApi();
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter();
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  // Listening starts now, not after the compile: a device lost while the
  // program is being made must not be handed out as if it were fine.
  const early: { reason: string | null } = { reason: null };
  const lose = (reason: string) => {
    if (held?.device === device) forget(device, reason);
    else early.reason ??= reason;
  };
  void device.lost.then((lost) => {
    lose(lost.message ?? lost.reason ?? "device lost");
  });
  device.addEventListener("uncapturederror", (event) => {
    event.preventDefault();
    lose(event.error.message);
  });
  let parts: OrbGpu;
  try {
    const format = gpu.getPreferredCanvasFormat();
    const shader = device.createShaderModule({ code: shaderSource });
    const info = await shader.getCompilationInfo();
    if (info.messages.some((message) => message.type === "error")) {
      device.destroy();
      return null;
    }
    const pipeline = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: shader, entryPoint: "vs_main" },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{ format, blend: { color: OVER, alpha: OVER } }],
      },
      primitive: { topology: "triangle-list" },
    });
    parts = { device, format, pipeline };
  } catch {
    device.destroy();
    return null;
  }
  if (early.reason !== null) {
    // The callers draw the WebGL orb: they are given nothing, not a dead device.
    device.destroy();
    return null;
  }
  held = parts;
  return parts;
}

/** For the tests: a page that has not prepared anything yet. */
export function resetOrbGpuForTests() {
  preparing = null;
  held = null;
  listeners.clear();
}
