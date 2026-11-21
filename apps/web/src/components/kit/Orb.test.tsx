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
