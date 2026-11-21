import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeGpu, removeFakeGpu } from "./fakeGpu";
import { LiquidOrb } from "./LiquidOrb";
import { prepareOrbGpu } from "./orbGpu";
import type { OrbTokens } from "./orbPalette";

const TOKENS: OrbTokens = {
  ground: [0.1, 0.1, 0.1],
  accent: [0.1, 0.6, 0.5],
  info: [0.2, 0.4, 0.9],
  ink: [0.9, 0.9, 0.9],
};

afterEach(removeFakeGpu);

async function borrow() {
  const gpu = installFakeGpu({ compiled: true });
  const parts = await prepareOrbGpu();
  if (!parts) throw new Error("not prepared");
  return { gpu, parts };
}

function hooks() {
  return { onFail: vi.fn(), onFirstFrame: vi.fn() };
}

describe("an orb that borrows the page's program", () => {
  it("owns only its context, buffer and bind group: destroying it never destroys the device", async () => {
    const { gpu, parts } = await borrow();
    const canvas = document.createElement("canvas");
    const orb = LiquidOrb.create(canvas, parts, TOKENS, hooks());
    expect(orb).not.toBeNull();
    const device = gpu.devices[0];
    orb?.destroy();
    expect(device?.destroy).not.toHaveBeenCalled();
    expect(device?.buffers[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(gpu.contexts.get(canvas)?.unconfigure).toHaveBeenCalledTimes(1);
    // Destroying twice frees nothing twice.
    orb?.destroy();
    expect(device?.buffers[0]?.destroy).toHaveBeenCalledTimes(1);
  });

  it("makes no pipeline of its own: the device made one, for the page", async () => {
    const { gpu, parts } = await borrow();
    LiquidOrb.create(document.createElement("canvas"), parts, TOKENS, hooks());
    LiquidOrb.create(document.createElement("canvas"), parts, TOKENS, hooks());
    const calls = gpu.devices[0]?.calls ?? [];
    expect(calls.filter((call) => call.includes("Pipeline"))).toEqual([
      "createRenderPipelineAsync",
    ]);
    expect(gpu.deviceRequests).toBe(1);
  });

  it("lets one device configure two canvases, and destroying one leaves the other drawing", async () => {
    const { gpu, parts } = await borrow();
    const one = document.createElement("canvas");
    const two = document.createElement("canvas");
    const first = LiquidOrb.create(one, parts, TOKENS, hooks());
    const second = LiquidOrb.create(two, parts, TOKENS, hooks());
    expect(first && second).toBeTruthy();
    expect(gpu.contexts.get(one)?.configure).toHaveBeenCalledTimes(1);
    expect(gpu.contexts.get(two)?.configure).toHaveBeenCalledTimes(1);
    first?.destroy();
    expect(gpu.contexts.get(two)?.unconfigure).not.toHaveBeenCalled();
    expect(gpu.devices[0]?.buffers[1]?.destroy).not.toHaveBeenCalled();
  });

  it("returns null when the canvas gives no WebGPU context", async () => {
    const { parts } = await borrow();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(
      LiquidOrb.create(
        document.createElement("canvas"),
        parts,
        TOKENS,
        hooks(),
      ),
    ).toBeNull();
  });
});

describe("what an orb reports", () => {
  it("says once that its first frame is on the screen, and draws nothing while it may not run", async () => {
    const { gpu, parts } = await borrow();
    const told = hooks();
    const orb = LiquidOrb.create(
      document.createElement("canvas"),
      parts,
      TOKENS,
      told,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gpu.devices[0]?.submits).not.toHaveBeenCalled();
    expect(told.onFirstFrame).not.toHaveBeenCalled();
    orb?.setRunning(true);
    await vi.waitFor(() => {
      expect(told.onFirstFrame).toHaveBeenCalledTimes(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(told.onFirstFrame).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(gpu.devices[0]?.submits ?? vi.fn()).mock.calls.length,
    ).toBeGreaterThan(1);
    orb?.setRunning(false);
    const drawn = gpu.devices[0]?.submits.mock.calls.length ?? 0;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(gpu.devices[0]?.submits.mock.calls.length).toBe(drawn);
    orb?.destroy();
  });

  it("is told of a lost device once, frees what it owns and asks its caller for the fallback", async () => {
    const { gpu, parts } = await borrow();
    const told = hooks();
    const canvas = document.createElement("canvas");
    LiquidOrb.create(canvas, parts, TOKENS, told);
    gpu.devices[0]?.lose("device lost");
    await vi.waitFor(() => {
      expect(told.onFail).toHaveBeenCalledTimes(1);
    });
    expect(told.onFail).toHaveBeenCalledWith("device lost");
    expect(gpu.contexts.get(canvas)?.unconfigure).toHaveBeenCalledTimes(1);
  });

  it("does not tell a caller that has already destroyed it", async () => {
    const { gpu, parts } = await borrow();
    const told = hooks();
    const orb = LiquidOrb.create(
      document.createElement("canvas"),
      parts,
      TOKENS,
      told,
    );
    orb?.destroy();
    gpu.devices[0]?.lose("device lost");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(told.onFail).not.toHaveBeenCalled();
  });
});
