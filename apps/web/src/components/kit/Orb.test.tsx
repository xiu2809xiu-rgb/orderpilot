import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manualFrames, stubWebgl2 } from "@/test/webglStub";
import { Orb, type Rgb } from "./Orb";

const COLOUR: Rgb = [0.2, 0.5, 0.4];
const COLOURS = [COLOUR, COLOUR, COLOUR] as const;

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the WebGL orb tells its caller when it has drawn", () => {
  it("says once, after its first frame and not before", () => {
    stubWebgl2();
    const frames = manualFrames();
    const onFirstFrame = vi.fn();
    render(
      <Orb colours={COLOURS} ground={COLOUR} onFirstFrame={onFirstFrame} />,
    );
    // Sized and drawn once, but no frame of the loop has run yet.
    expect(onFirstFrame).not.toHaveBeenCalled();
    act(() => {
      frames.step();
    });
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
    act(() => {
      frames.step(32);
      frames.step(48);
    });
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("says once at once under reduced motion, which draws one frame and runs no loop", () => {
    reducedMotion(true);
    stubWebgl2();
    const frames = manualFrames();
    const onFirstFrame = vi.fn();
    render(
      <Orb colours={COLOURS} ground={COLOUR} onFirstFrame={onFirstFrame} />,
    );
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
    expect(frames.waiting).toBe(0);
  });

  it("says that it is unavailable, and never that it has drawn, where there is no WebGL2", () => {
    const onFirstFrame = vi.fn();
    const onUnavailable = vi.fn();
    render(
      <Orb
        colours={COLOURS}
        ground={COLOUR}
        onFirstFrame={onFirstFrame}
        onUnavailable={onUnavailable}
      />,
    );
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(onFirstFrame).not.toHaveBeenCalled();
  });
});

/**
 * A WebGL2 context like the stub's, which also keeps every value given to the
 * uniform named `uTime`, so a test can read how far the orb's clock moved.
 */
function glThatKeepsTime() {
  const times: number[] = [];
  const named = { uTime: { name: "uTime" } };
  const gl = new Proxy(
    {
      getUniformLocation: (_program: unknown, name: string) =>
        name === "uTime" ? named.uTime : {},
      uniform1f: (location: unknown, value: number) => {
        if (location === named.uTime) times.push(value);
      },
    },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : vi.fn(() => ({})),
    },
  ) as unknown as WebGL2RenderingContext;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (kind: string) {
      return kind === "webgl2" ? gl : null;
    } as HTMLCanvasElement["getContext"],
  );
  return times;
}

describe("how fast the WebGL orb flows", () => {
  const stepOf = (times: number[]) => (times.at(-1) ?? 0) - (times.at(-2) ?? 0);

  it("flows 1.75 times the kit's pace at idle, as the WebGPU orb's idle went from 2 to 3.5", () => {
    const times = glThatKeepsTime();
    const frames = manualFrames();
    render(<Orb colours={COLOURS} ground={COLOUR} />);
    act(() => {
      frames.step(1000);
      frames.step(1016);
    });
    // 16 ms of the page's time moves the orb's clock 1.75 times as far.
    expect(stepOf(times)).toBeCloseTo(0.016 * 1.75, 6);
  });

  it("flows half as fast again while Spark is thinking", () => {
    const times = glThatKeepsTime();
    const frames = manualFrames();
    render(<Orb colours={COLOURS} ground={COLOUR} thinking />);
    act(() => {
      frames.step(1000);
      frames.step(1016);
    });
    expect(stepOf(times)).toBeCloseTo(0.016 * 1.75 * 1.5, 6);
  });
});
