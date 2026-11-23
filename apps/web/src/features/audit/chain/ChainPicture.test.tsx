import type { AuditChainCheck } from "@orderpilot/shared";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manualFrames } from "@/test/webglStub";
import { ChainPicture } from "./ChainPicture";
import { chainModel, type ChainKnowledge } from "./chainModel";

const AT = "2026-11-24T02:00:00.000Z";
const BROKEN: AuditChainCheck = {
  ok: false,
  checked: 1221,
  verifiedThrough: 1221,
  brokenAtSequence: 1222,
  brokenAtEventId: "0194f3a0-0000-7000-8000-000000000222",
  problem: "hash-mismatch",
  checkedAt: AT,
};

const picture = (knowledge: ChainKnowledge) => chainModel(knowledge, 7);

/** A WebGL2 context that keeps the last value of each uniform the picture sets. */
function recordingGl() {
  const values = new Map<string, unknown>();
  const named = (name: string) => ({ name });
  const set = (location: unknown, value: unknown) => {
    if (location && typeof location === "object" && "name" in location) {
      values.set(String(location.name), value);
    }
  };
  const gl = new Proxy(
    {
      getUniformLocation: (_program: unknown, name: string) => named(name),
      // No lose-context extension, as some browsers have none.
      getExtension: () => null,
      uniform1f: set,
      uniform1fv: (location: unknown, value: Float32Array) => {
        set(location, Array.from(value));
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
  return values;
}

/** A browser where the person asked for less motion; afterEach restores it. */
function reducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      // Only what the picture and the kit read; the old listener methods are left out.
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the picture of the chain check (F-10)", () => {
  it("is hidden from screen readers, and numbers only the newest verified event and the break", () => {
    const { container } = render(
      <ChainPicture picture={picture({ kind: "checked", result: BROKEN })} />,
    );
    const root = container.querySelector("[data-chain-picture]");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.textContent).toBe("12211222");
    // jsdom has no WebGL2, so it is the plain CSS picture.
    expect(container.querySelector("[data-fallback]")).not.toBeNull();
  });

  it("tells the shader each block's state, and the break, and runs no light", () => {
    const values = recordingGl();
    render(
      <ChainPicture picture={picture({ kind: "checked", result: BROKEN })} />,
    );
    expect(values.get("uCount")).toBe(7);
    expect(values.get("uSlots")).toBe(7);
    expect(values.get("uState")).toEqual([1, 1, 1, 1, 1, 1, 2, 0]);
    expect(values.get("uEarlier")).toBe(1);
    expect(values.get("uTravel")).toBe(0);
    expect(values.get("uSettle")).toBe(1);
  });

  it("moves while a check runs, lights the blocks after it, and then rests", () => {
    vi.useFakeTimers();
    const values = recordingGl();
    const frames = manualFrames();
    const { rerender } = render(
      <ChainPicture picture={picture({ kind: "checking" })} />,
    );
    act(() => {
      frames.step(1000);
    });
    expect(values.get("uTravel")).toBe(1);
    expect(frames.waiting).toBe(1);

    rerender(
      <ChainPicture picture={picture({ kind: "checked", result: BROKEN })} />,
    );
    act(() => {
      frames.step(1016);
      frames.step(1216);
    });
    // Lighting up: still moving, part way along.
    expect(values.get("uTravel")).toBe(0);
    expect(values.get("uSettle")).toBeGreaterThan(0);
    expect(values.get("uSettle")).toBeLessThan(1);
    expect(frames.waiting).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      frames.step(2300);
    });
    // At rest: no frame is asked for, and the blocks are fully lit.
    expect(frames.waiting).toBe(0);
    expect(values.get("uSettle")).toBe(1);
  });

  it("does not move at all for a person who asked for less motion", () => {
    reducedMotion();
    const values = recordingGl();
    const frames = manualFrames();
    render(<ChainPicture picture={picture({ kind: "checking" })} />);
    act(() => {
      frames.step(1000);
    });
    expect(frames.waiting).toBe(0);
    // One still frame is drawn, with everything settled.
    expect(values.get("uSettle")).toBe(1);
  });

  it("puts a click target on the red block only, out of the tab order", () => {
    const link = { to: "/audit?event=x&around=1222", label: "Open event 1222" };
    const { container } = render(
      <MemoryRouter>
        <ChainPicture
          picture={picture({ kind: "checked", result: BROKEN })}
          brokenLink={link}
        />
      </MemoryRouter>,
    );
    const block = container.querySelector("[data-chain-break]");
    expect(block).toHaveAttribute("href", link.to);
    expect(block).toHaveAttribute("tabindex", "-1");
    expect(block).toHaveAttribute("title", "Open event 1222");
    // Over the last of seven slots.
    expect(parseFloat((block as HTMLElement).style.left)).toBeCloseTo(
      (6 / 7) * 100,
    );
  });

  it("offers no click target while the chain verifies, or while it is checked again", () => {
    const link = { to: "/audit?event=x&around=1222", label: "Open event 1222" };
    for (const knowledge of [
      { kind: "checking" },
      {
        kind: "checked",
        result: { ...BROKEN, ok: true, brokenAtSequence: null },
      },
    ] as const) {
      const { container, unmount } = render(
        <ChainPicture picture={picture(knowledge)} brokenLink={link} />,
      );
      expect(container.querySelector("[data-chain-break]")).toBeNull();
      unmount();
    }
  });

  it("asks for no frames before any check", () => {
    recordingGl();
    const frames = manualFrames();
    render(<ChainPicture picture={picture({ kind: "never" })} />);
    act(() => {
      frames.step(1000);
    });
    expect(frames.waiting).toBe(0);
  });
});
