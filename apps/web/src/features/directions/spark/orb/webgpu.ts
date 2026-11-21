/**
 * The few WebGPU types the orb uses. TypeScript's own library does not ship
 * them and the project does not install `@webgpu/types` for one component, so
 * this is the exact surface the orb calls, nothing more. Everything is
 * optional where a browser may not have it: `navigator.gpu` is the test.
 */
export interface GpuBuffer {
  destroy(): void;
}

export interface GpuTextureView {
  readonly __view: never;
}

export interface GpuRenderPass {
  setPipeline(pipeline: GpuRenderPipeline): void;
  setBindGroup(index: number, group: GpuBindGroup): void;
  draw(count: number): void;
  end(): void;
}

export interface GpuRenderPipeline {
  getBindGroupLayout(index: number): unknown;
}

export type GpuBindGroup = object;

export interface GpuCommandEncoder {
  beginRenderPass(descriptor: {
    colorAttachments: {
      view: GpuTextureView;
      clearValue: { r: number; g: number; b: number; a: number };
      loadOp: "clear";
      storeOp: "store";
    }[];
  }): GpuRenderPass;
  finish(): object;
}

export interface GpuDevice {
  readonly lost: Promise<{ message?: string; reason?: string }>;
  readonly queue: {
    writeBuffer(buffer: GpuBuffer, offset: number, data: Float32Array): void;
    submit(buffers: object[]): void;
    onSubmittedWorkDone(): Promise<void>;
  };
  addEventListener(
    type: "uncapturederror",
    listener: (event: Event & { error: { message: string } }) => void,
  ): void;
  createShaderModule(descriptor: { code: string }): {
    getCompilationInfo(): Promise<{
      messages: { type: string; message: string; lineNum: number }[];
    }>;
  };
  /** Never the blocking createRenderPipeline: it holds the GPU process, and the page with it, while it compiles. */
  createRenderPipelineAsync(descriptor: object): Promise<GpuRenderPipeline>;
  createBuffer(descriptor: { size: number; usage: number }): GpuBuffer;
  createBindGroup(descriptor: {
    layout: unknown;
    entries: { binding: number; resource: { buffer: GpuBuffer } }[];
  }): GpuBindGroup;
  createCommandEncoder(): GpuCommandEncoder;
  destroy(): void;
}

export interface GpuCanvasContext {
  configure(descriptor: {
    device: GpuDevice;
    format: string;
    alphaMode: "premultiplied";
  }): void;
  unconfigure(): void;
  getCurrentTexture(): { createView(): GpuTextureView };
}

export interface GpuApi {
  requestAdapter(): Promise<{ requestDevice(): Promise<GpuDevice> } | null>;
  getPreferredCanvasFormat(): string;
}

/** `navigator.gpu`, or null where the browser has no WebGPU (and in the tests). */
export function gpuApi(): GpuApi | null {
  const candidate: unknown = Reflect.get(navigator, "gpu");
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "requestAdapter" in candidate
  ) {
    return candidate as GpuApi;
  }
  return null;
}

/** GPUBufferUsage.UNIFORM and COPY_DST, as the specification numbers them. */
export const BUFFER_UNIFORM_COPY_DST = 0x40 | 0x08;
