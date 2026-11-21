import { vi } from "vitest";
import { resetOrbGpuForTests } from "./orbGpu";

/** A device that records what the orb asks of it. Only tests import this file. */
export class FakeDevice {
  readonly calls: string[] = [];
  readonly buffers: { destroy: ReturnType<typeof vi.fn> }[] = [];
  readonly destroy = vi.fn();
  readonly submits = vi.fn();
  private readonly errorListeners: ((
    event: Event & { error: { message: string } },
  ) => void)[] = [];
  private loseNow: (lost: { message?: string; reason?: string }) => void = () =>
    undefined;
  readonly lost = new Promise<{ message?: string; reason?: string }>(
    (resolve) => {
      this.loseNow = resolve;
    },
  );
  readonly queue = {
    writeBuffer: vi.fn(),
    submit: this.submits,
    onSubmittedWorkDone: () => Promise.resolve(),
  };

  constructor(
    private readonly options: {
      shaderErrors: boolean;
      pipeline: Promise<void>;
    },
  ) {}

  addEventListener(
    _type: "uncapturederror",
    listener: (event: Event & { error: { message: string } }) => void,
  ) {
    this.errorListeners.push(listener);
  }
  /** The browser reports an error that nobody caught. */
  raise(message: string) {
    const event = Object.assign(new Event("uncapturederror"), {
      error: { message },
    });
    for (const listener of this.errorListeners) listener(event);
  }
  /** The browser reports the device lost. */
  lose(message: string) {
    this.loseNow({ message });
  }
  createShaderModule() {
    this.calls.push("createShaderModule");
    return {
      getCompilationInfo: () =>
        Promise.resolve({
          messages: this.options.shaderErrors
            ? [{ type: "error", message: "bad", lineNum: 1 }]
            : [],
        }),
    };
  }
  /** The blocking call. The orb must never make it. */
  createRenderPipeline(): never {
    this.calls.push("createRenderPipeline");
    throw new Error("the blocking createRenderPipeline was called");
  }
  async createRenderPipelineAsync() {
    this.calls.push("createRenderPipelineAsync");
    await this.options.pipeline;
    return { getBindGroupLayout: () => ({}) };
  }
  createBuffer() {
    this.calls.push("createBuffer");
    const buffer = { destroy: vi.fn() };
    this.buffers.push(buffer);
    return buffer;
  }
  createBindGroup() {
    this.calls.push("createBindGroup");
    return {};
  }
  createCommandEncoder() {
    return {
      beginRenderPass: () => ({
        setPipeline: () => undefined,
        setBindGroup: () => undefined,
        draw: () => undefined,
        end: () => undefined,
      }),
      finish: () => ({}),
    };
  }
}

export interface FakeContext {
  configure: ReturnType<typeof vi.fn>;
  unconfigure: ReturnType<typeof vi.fn>;
  getCurrentTexture: () => { createView: () => object };
}

export interface FakeGpu {
  adapterRequests: number;
  deviceRequests: number;
  devices: FakeDevice[];
  /** One context per canvas, as a browser gives the same one back. */
  contexts: Map<HTMLCanvasElement, FakeContext>;
  /** Lets the pending pipeline compile finish. */
  finishCompile: () => void;
}

/**
 * Gives the page a WebGPU of recorded fakes: `navigator.gpu`, and a "webgpu"
 * context on every canvas. The compile of the pipeline waits until the test
 * calls `finishCompile` (or finishes at once with `compiled: true`), so a test
 * can look at the orb while the program is still being made.
 */
export function installFakeGpu(
  options: {
    noAdapter?: boolean;
    shaderErrors?: boolean;
    compiled?: boolean;
  } = {},
): FakeGpu {
  resetOrbGpuForTests();
  let finish: () => void = () => undefined;
  const pipeline = options.compiled
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        finish = resolve;
      });
  const fake: FakeGpu = {
    adapterRequests: 0,
    deviceRequests: 0,
    devices: [],
    contexts: new Map(),
    finishCompile: () => {
      finish();
    },
  };
  const api = {
    getPreferredCanvasFormat: () => "bgra8unorm",
    requestAdapter: () => {
      fake.adapterRequests += 1;
      if (options.noAdapter) return Promise.resolve(null);
      return Promise.resolve({
        requestDevice: () => {
          fake.deviceRequests += 1;
          const device = new FakeDevice({
            shaderErrors: options.shaderErrors ?? false,
            pipeline,
          });
          fake.devices.push(device);
          return Promise.resolve(device);
        },
      });
    },
  };
  Object.defineProperty(navigator, "gpu", { value: api, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement, kind: string) {
      if (kind !== "webgpu") return null;
      let context = fake.contexts.get(this);
      if (!context) {
        context = {
          configure: vi.fn(),
          unconfigure: vi.fn(),
          getCurrentTexture: () => ({ createView: () => ({}) }),
        };
        fake.contexts.set(this, context);
      }
      return context as unknown as RenderingContext;
    },
  );
  return fake;
}

/** Takes the fakes away again. */
export function removeFakeGpu() {
  Reflect.deleteProperty(navigator, "gpu");
  resetOrbGpuForTests();
  vi.restoreAllMocks();
}
