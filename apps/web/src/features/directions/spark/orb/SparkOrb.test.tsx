import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { manualFrames, stubWebgl2 } from "@/test/webglStub";
import { installFakeGpu, removeFakeGpu } from "./fakeGpu";
import { SparkOrb } from "./SparkOrb";

/** jsdom cannot tell what is on screen: say that everything is, as a browser would. */
class Everything {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {
    // Nothing to stop.
  }
  disconnect() {
    // Nothing to stop.
  }
}

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** A reduced-motion setting that the test can switch while the orb is on screen. */
function switchableMotion() {
  let reduce = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return reduce && query.includes("reduce");
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));
  return {
    reduce(on: boolean) {
      reduce = on;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", Everything);
  reducedMotion(false);
});
afterEach(() => {
  removeFakeGpu();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const orb = () => screen.getByRole("img", { name: "Spark is ready" });
const cssOrb = (holder: HTMLElement) =>
  holder.querySelector(".spark-orb-still");
const orbOf = (holder: HTMLElement) =>
  holder.querySelector<HTMLCanvasElement>("canvas");

function show(state: "idle" | "thinking" = "idle") {
  return render(<SparkOrb state={state} label="Spark is ready" />);
}

describe("an orb that is never an empty square", () => {
  it("draws the CSS orb at once, while the GPU program is still being made, with the canvas clear", async () => {
    const gpu = installFakeGpu();
    show();
    const holder = orb();
    // The very first render: before the GPU has been asked anything.
    expect(cssOrb(holder)).not.toBeNull();
    expect(holder).toHaveAttribute("data-showing", "css");
    await waitFor(() => {
      expect(gpu.devices[0]?.calls).toContain("createRenderPipelineAsync");
    });
    expect(cssOrb(holder)).not.toBeNull();
    expect(holder).toHaveAttribute("data-showing", "css");
    expect(orbOf(holder)).toHaveAttribute("data-ready", "false");
  });

  it("fades the drawn orb in on its first frame, then takes the CSS orb out of the tree", async () => {
    const gpu = installFakeGpu();
    show();
    const holder = orb();
    gpu.finishCompile();
    await waitFor(() => {
      expect(holder).toHaveAttribute("data-showing", "webgpu");
    });
    expect(orbOf(holder)).toHaveAttribute("data-ready", "true");
    // Over the CSS orb for the length of the fade, never a gap.
    expect(cssOrb(holder)).not.toBeNull();
    await waitFor(() => {
      expect(cssOrb(holder)).toBeNull();
    });
    expect(holder).toHaveAttribute("data-engine", "webgpu");
  });

  it("is on screen at once the second time, with no second preparation", async () => {
    const gpu = installFakeGpu({ compiled: true });
    const first = show();
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-showing", "webgpu");
    });
    first.unmount();
    show();
    // The CSS orb is there in the first render, and the same device is used.
    expect(cssOrb(orb())).not.toBeNull();
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-showing", "webgpu");
    });
    expect(gpu.adapterRequests).toBe(1);
    expect(gpu.deviceRequests).toBe(1);
    expect(gpu.devices[0]?.destroy).not.toHaveBeenCalled();
    expect(
      gpu.devices[0]?.calls.filter((call) => call.includes("Pipeline")),
    ).toEqual(["createRenderPipelineAsync"]);
  });
});

/** An observer the test drives: what is on screen is what the test says. */
class Driven {
  static all: Driven[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    Driven.all.push(this);
  }
  observe() {
    // Nothing is reported until the test says so.
  }
  unobserve() {
    // Nothing to stop.
  }
  disconnect() {
    // Nothing to stop.
  }
  show(on: boolean) {
    this.callback(
      [{ isIntersecting: on } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const framesOf = (gpu: ReturnType<typeof installFakeGpu>) =>
  gpu.devices[0]?.submits.mock.calls.length ?? 0;
/** Steps the page's frames by hand, a few of them: no waiting on a clock. */
function stepFrames(frames: ReturnType<typeof manualFrames>, count = 3) {
  act(() => {
    for (let index = 0; index < count; index += 1) frames.step();
  });
}

describe("an orb nobody can see", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "hidden");
    Driven.all = [];
  });

  it("draws no frames while it is off screen, and draws once it is on screen", async () => {
    vi.stubGlobal("IntersectionObserver", Driven);
    const frames = manualFrames();
    const gpu = installFakeGpu({ compiled: true });
    show();
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-engine", "webgpu");
    });
    await waitFor(() => {
      expect(gpu.contexts.size).toBe(1);
    });
    act(() => {
      for (const watcher of Driven.all) watcher.show(false);
    });
    stepFrames(frames);
    expect(framesOf(gpu)).toBe(0);
    act(() => {
      for (const watcher of Driven.all) watcher.show(true);
    });
    stepFrames(frames);
    expect(framesOf(gpu)).toBeGreaterThan(1);
    act(() => {
      for (const watcher of Driven.all) watcher.show(false);
    });
    const stopped = framesOf(gpu);
    stepFrames(frames);
    expect(framesOf(gpu)).toBe(stopped);
  });

  it("draws no frames in a hidden tab, and draws when the tab is shown", async () => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    const frames = manualFrames();
    const gpu = installFakeGpu({ compiled: true });
    show();
    await waitFor(() => {
      expect(gpu.contexts.size).toBe(1);
    });
    stepFrames(frames);
    expect(framesOf(gpu)).toBe(0);
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    stepFrames(frames);
    expect(framesOf(gpu)).toBeGreaterThan(1);
  });
});

describe("reduced motion", () => {
  it("shows the CSS orb and starts no GPU work", async () => {
    reducedMotion(true);
    const gpu = installFakeGpu({ compiled: true });
    show();
    // Let every promise the orb could have started settle: it starts none.
    await act(async () => {
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
    const holder = orb();
    expect(holder).toHaveAttribute("data-engine", "still");
    expect(holder).toHaveAttribute("data-showing", "css");
    expect(cssOrb(holder)).not.toBeNull();
    expect(gpu.adapterRequests).toBe(0);
    expect(gpu.contexts.size).toBe(0);
  });

  it("is never an empty square when reduced motion is switched off again after the drawn orb was shown", async () => {
    const motion = switchableMotion();
    installFakeGpu({ compiled: true });
    show();
    await waitFor(() => {
      expect(cssOrb(orb())).toBeNull();
    });
    expect(orb()).toHaveAttribute("data-showing", "webgpu");
    motion.reduce(true);
    expect(orb()).toHaveAttribute("data-engine", "still");
    expect(orb()).toHaveAttribute("data-showing", "css");
    expect(cssOrb(orb())).not.toBeNull();
    motion.reduce(false);
    // A new canvas has been mounted, and it has drawn nothing yet.
    expect(orb()).toHaveAttribute("data-engine", "webgpu");
    expect(orb()).toHaveAttribute("data-showing", "css");
    expect(cssOrb(orb())).not.toBeNull();
    expect(orbOf(orb())).toHaveAttribute("data-ready", "false");
    // Until its first frame, and then the same hand-over as the first time.
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-showing", "webgpu");
    });
    await waitFor(() => {
      expect(cssOrb(orb())).toBeNull();
    });
  });
});

describe("two mounts in a row, as a development server does", () => {
  it("end with one working orb, one device and no error", async () => {
    const gpu = installFakeGpu({ compiled: true });
    const told = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    render(
      <StrictMode>
        <SparkOrb state="idle" label="Spark is ready" onEngine={told} />
      </StrictMode>,
    );
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-showing", "webgpu");
    });
    expect(orb()).toHaveAttribute("data-engine", "webgpu");
    expect(gpu.deviceRequests).toBe(1);
    const canvas = orbOf(orb());
    if (!canvas) throw new Error("no canvas");
    const context = gpu.contexts.get(canvas);
    // Configured by the mount that stayed, and not unconfigured by the one that left.
    expect(context?.configure).toHaveBeenCalledTimes(1);
    expect(context?.unconfigure).not.toHaveBeenCalled();
    expect(gpu.devices[0]?.buffers.length).toBe(1);
    expect(gpu.devices[0]?.buffers[0]?.destroy).not.toHaveBeenCalled();
    expect(told).toHaveBeenCalledWith("webgpu");
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("what takes over when the GPU does not", () => {
  it("falls back to the WebGL orb when the device is lost, and says so", async () => {
    const gpu = installFakeGpu({ compiled: true });
    const told = vi.fn();
    render(<SparkOrb state="idle" label="Spark is ready" onEngine={told} />);
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-showing", "webgpu");
    });
    gpu.devices[0]?.lose("lost");
    await waitFor(() => {
      expect(orb()).not.toHaveAttribute("data-engine", "webgpu");
    });
    // jsdom has no WebGL either, so the CSS orb is what is left, and it is there.
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-engine", "still");
    });
    expect(cssOrb(orb())).not.toBeNull();
    expect(orb()).toHaveAttribute("data-showing", "css");
    expect(told).toHaveBeenLastCalledWith("still");
  });

  it("hands over to the WebGL orb where there is no WebGPU: CSS first, then the drawn orb, then the CSS orb leaves", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubWebgl2();
    const frames = manualFrames();
    show();
    const holder = orb();
    expect(holder).toHaveAttribute("data-engine", "webgl");
    expect(holder).toHaveAttribute("data-showing", "css");
    expect(cssOrb(holder)).not.toBeNull();
    const layer = holder.querySelector(".spark-orb-layer");
    expect(layer).toHaveAttribute("data-ready", "false");
    stepFrames(frames, 1);
    expect(holder).toHaveAttribute("data-showing", "webgl");
    expect(layer).toHaveAttribute("data-ready", "true");
    // Over the CSS orb for the length of the fade, never a gap.
    expect(cssOrb(holder)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(cssOrb(holder)).toBeNull();
    vi.useRealTimers();
  });

  it("draws the CSS orb where there is no WebGPU and no WebGL", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    show();
    await waitFor(() => {
      expect(orb()).toHaveAttribute("data-engine", "still");
    });
    expect(cssOrb(orb())).not.toBeNull();
    expect(orb()).toHaveAttribute("data-showing", "css");
  });
});

describe("two orbs on one page, as the kit page and the upload screen have them", () => {
  it("share one device and one program, and one going away leaves the other drawing", async () => {
    const gpu = installFakeGpu({ compiled: true });
    const told = vi.fn();
    const both = render(
      <>
        <SparkOrb state="idle" label="Spark is ready" onEngine={told} />
        <SparkOrb state="thinking" label="Spark is working" />
      </>,
    );
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Spark is ready" }),
      ).toHaveAttribute("data-showing", "webgpu");
      expect(
        screen.getByRole("img", { name: "Spark is working" }),
      ).toHaveAttribute("data-showing", "webgpu");
    });
    expect(gpu.deviceRequests).toBe(1);
    expect(gpu.contexts.size).toBe(2);
    expect(told).toHaveBeenCalledWith("webgpu");
    both.rerender(<SparkOrb state="thinking" label="Spark is working" />);
    await waitFor(() => {
      expect(
        [...gpu.contexts.values()].filter(
          (context) => context.unconfigure.mock.calls.length === 1,
        ),
      ).toHaveLength(1);
    });
    expect(gpu.devices[0]?.destroy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("img", { name: "Spark is working" }),
    ).toHaveAttribute("data-showing", "webgpu");
  });
});

describe("the orb on the page", () => {
  it("keeps its label for assistive technology and passes the state on", () => {
    installFakeGpu();
    show("thinking");
    expect(orb()).toHaveAttribute("data-state", "thinking");
    expect(cssOrb(orb())).toHaveAttribute("data-state", "thinking");
  });
});
