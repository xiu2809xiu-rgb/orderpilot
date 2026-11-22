import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { manualFrames, stubCanvasContexts } from "@/test/webglStub";
import { PixelToggle } from "./PixelToggle";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** jsdom has no layout: give the switch the size the bar gives it (36 px high). */
function sizeIt() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 68.8125, 36),
  );
}

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** The engine arrives after the first paint, and makes its two canvases when it does. */
async function engineArrived(button: HTMLElement) {
  await waitFor(() => {
    expect(button.querySelectorAll("canvas")).toHaveLength(2);
  });
}

async function mount(ui: ReactElement) {
  const view = render(ui);
  const button = screen.getByRole("switch");
  await engineArrived(button);
  return { ...view, button };
}

function toggle(props: Partial<Parameters<typeof PixelToggle>[0]> = {}) {
  return <PixelToggle checked label="Light theme" {...props} />;
}

describe("the pixel toggle as a button", () => {
  it("is a switch with its name and its state", () => {
    render(toggle({ checked: true }));
    const button = screen.getByRole("switch", { name: "Light theme" });
    expect(button).toHaveAttribute("aria-checked", "true");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("says it is off when it is not checked", () => {
    render(toggle({ checked: false }));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onCheckedChange once with the opposite value on a click, before the engine has arrived", async () => {
    const onCheckedChange = vi.fn();
    render(toggle({ checked: true, onCheckedChange }));
    await userEvent.setup().click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("does the same once the engine has arrived, and only once", async () => {
    const onCheckedChange = vi.fn();
    const { button } = await mount(toggle({ checked: false, onCheckedChange }));
    await userEvent.setup().click(button);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("switches with Space and with Enter, which are clicks with no pointer", async () => {
    const onCheckedChange = vi.fn();
    const { button } = await mount(toggle({ checked: true, onCheckedChange }));
    const user = userEvent.setup();
    button.focus();
    await user.keyboard(" ");
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    await user.keyboard("{Enter}");
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it("calls the latest handler, not the one it started with", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { button, rerender } = await mount(
      toggle({ checked: true, onCheckedChange: first }),
    );
    rerender(toggle({ checked: true, onCheckedChange: second }));
    await userEvent.setup().click(button);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("a change of checked from outside", () => {
  it("never calls onCheckedChange, and moves the switch", async () => {
    stubCanvasContexts();
    sizeIt();
    const frames = manualFrames();
    const onCheckedChange = vi.fn();
    const { button, rerender } = await mount(
      toggle({ checked: false, onCheckedChange }),
    );
    rerender(toggle({ checked: true, onCheckedChange }));
    expect(button).toHaveAttribute("aria-checked", "true");
    // The engine follows with an animation of its own, and still says nothing.
    expect(frames.waiting).toBe(1);
    for (let at = 16; at < 1600; at += 16) frames.step(at);
    rerender(toggle({ checked: false, onCheckedChange }));
    for (let at = 1616; at < 3200; at += 16) frames.step(at);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("makes no sound", async () => {
    const made = vi.fn();
    vi.stubGlobal("AudioContext", made);
    const { button, rerender } = await mount(toggle({ checked: false }));
    rerender(toggle({ checked: true }));
    expect(button).toHaveAttribute("aria-checked", "true");
    expect(made).not.toHaveBeenCalled();
  });
});

describe("the engine's canvases and frames", () => {
  it("removes the canvases it made when it unmounts, and cancels its frame", async () => {
    stubCanvasContexts();
    sizeIt();
    const frames = manualFrames();
    const { button, unmount } = await mount(toggle({ checked: false }));
    await userEvent.setup().click(button);
    expect(frames.waiting).toBe(1);
    unmount();
    expect(frames.waiting).toBe(0);
    expect(button.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("leaves exactly one glass canvas and one 2D canvas in React's development double mount", async () => {
    stubCanvasContexts();
    sizeIt();
    render(<StrictMode>{toggle({ checked: true })}</StrictMode>);
    const button = screen.getByRole("switch");
    await engineArrived(button);
    expect(button.querySelectorAll("canvas.pixel-glass")).toHaveLength(1);
    expect(button.querySelectorAll("canvas.pixel-effects")).toHaveLength(1);
  });

  it("draws with the glass renderer when WebGL2 is there, and hides the 2D canvas", async () => {
    const { kinds } = stubCanvasContexts();
    sizeIt();
    const { button } = await mount(toggle({ checked: true }));
    expect(button).toHaveAttribute("data-renderer", "glass");
    expect(kinds).toContain("webgl2");
    expect(
      button.querySelector<HTMLCanvasElement>("canvas.pixel-glass")?.hidden,
    ).toBe(false);
    expect(
      button.querySelector<HTMLCanvasElement>("canvas.pixel-effects")?.hidden,
    ).toBe(true);
  });

  it("draws nothing while the switch has no size, as in the top bar under 640 px", async () => {
    const { kinds } = stubCanvasContexts();
    const { button } = await mount(toggle({ checked: true }));
    expect(button).not.toHaveAttribute("data-renderer");
    expect(kinds).toHaveLength(0);
  });

  it("asks for no animation frame under reduced motion, and still switches", async () => {
    reducedMotion(true);
    stubCanvasContexts();
    sizeIt();
    const frames = manualFrames();
    const onCheckedChange = vi.fn();
    const { button } = await mount(toggle({ checked: false, onCheckedChange }));
    await userEvent.setup().click(button);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(frames.waiting).toBe(0);
  });

  it("does not throw with no 2D or WebGL context, which is jsdom's own", async () => {
    sizeIt();
    const onCheckedChange = vi.fn();
    const { button } = await mount(toggle({ checked: true, onCheckedChange }));
    await userEvent.setup().click(button);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(button).not.toHaveAttribute("data-renderer");
  });
});
