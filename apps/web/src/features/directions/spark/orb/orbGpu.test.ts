import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeGpu, removeFakeGpu } from "./fakeGpu";
import { onOrbGpuLoss, prepareOrbGpu } from "./orbGpu";

afterEach(removeFakeGpu);

describe("the page's one GPU program", () => {
  it("is prepared once, whoever asks and however often", async () => {
    const gpu = installFakeGpu({ compiled: true });
    const first = prepareOrbGpu();
    const second = prepareOrbGpu();
    expect(second).toBe(first);
    const [a, b] = await Promise.all([first, second]);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    await prepareOrbGpu();
    expect(gpu.adapterRequests).toBe(1);
    expect(gpu.deviceRequests).toBe(1);
  });

  it("makes its pipeline with the asynchronous call and never the blocking one", async () => {
    const gpu = installFakeGpu({ compiled: true });
    await prepareOrbGpu();
    const calls = gpu.devices[0]?.calls ?? [];
    expect(calls).toContain("createRenderPipelineAsync");
    expect(calls).not.toContain("createRenderPipeline");
  });

  it("is not ready until the compile is done, and does not make a second one meanwhile", async () => {
    const gpu = installFakeGpu();
    let ready = false;
    void prepareOrbGpu().then(() => {
      ready = true;
    });
    await vi.waitFor(() => {
      expect(gpu.devices[0]?.calls).toContain("createRenderPipelineAsync");
    });
    expect(ready).toBe(false);
    void prepareOrbGpu();
    gpu.finishCompile();
    await vi.waitFor(() => {
      expect(ready).toBe(true);
    });
    expect(gpu.devices[0]?.calls.filter((c) => c.includes("Pipeline"))).toEqual(
      ["createRenderPipelineAsync"],
    );
  });

  it.each([
    ["no WebGPU in the browser", () => undefined],
    ["no adapter", () => installFakeGpu({ noAdapter: true })],
    [
      "a shader that does not compile",
      () => installFakeGpu({ shaderErrors: true, compiled: true }),
    ],
  ])("resolves to null for %s", async (_name, set) => {
    set();
    expect(await prepareOrbGpu()).toBeNull();
  });

  it("frees the device it made if the shader does not compile", async () => {
    const gpu = installFakeGpu({ shaderErrors: true, compiled: true });
    await prepareOrbGpu();
    expect(gpu.devices[0]?.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("a lost device", () => {
  it.each([
    [
      "is lost",
      (device: { lose: (m: string) => void }) => {
        device.lose("gone");
      },
    ],
    [
      "raises an error nobody caught",
      (device: { raise: (m: string) => void }) => {
        device.raise("gone");
      },
    ],
  ])(
    "tells every orb once, is forgotten, and WebGPU is not tried again when it %s",
    async (_name, breakIt) => {
      const gpu = installFakeGpu({ compiled: true });
      expect(await prepareOrbGpu()).not.toBeNull();
      const one = vi.fn();
      const two = vi.fn();
      onOrbGpuLoss(one);
      onOrbGpuLoss(two);
      const device = gpu.devices[0];
      if (!device) throw new Error("no device");
      breakIt(device);
      await vi.waitFor(() => {
        expect(one).toHaveBeenCalledTimes(1);
      });
      // A second report of the same trouble is not a second telling.
      device.raise("again");
      device.lose("again");
      await Promise.resolve();
      expect(one).toHaveBeenCalledTimes(1);
      expect(two).toHaveBeenCalledTimes(1);
      expect(one).toHaveBeenCalledWith("gone");
      expect(await prepareOrbGpu()).toBeNull();
      expect(gpu.adapterRequests).toBe(1);
    },
  );

  it("does not tell an orb that has stopped listening", async () => {
    const gpu = installFakeGpu({ compiled: true });
    await prepareOrbGpu();
    const stopped = vi.fn();
    const kept = vi.fn();
    onOrbGpuLoss(stopped)();
    onOrbGpuLoss(kept);
    gpu.devices[0]?.lose("gone");
    await vi.waitFor(() => {
      expect(kept).toHaveBeenCalledTimes(1);
    });
    expect(stopped).not.toHaveBeenCalled();
  });
});
