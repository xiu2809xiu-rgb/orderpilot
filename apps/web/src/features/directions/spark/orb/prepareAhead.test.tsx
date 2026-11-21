import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleOrbPreparation, usePrepareOrbAhead } from "./prepareAhead";

const prepare = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));
vi.mock("./orbGpu", () => ({ prepareOrbGpu: prepare }));

type IdleCallback = () => void;
let idle: { run: IdleCallback; options: { timeout?: number } | undefined }[];

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    value,
    configurable: true,
  });
}
function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    value: hidden,
    configurable: true,
  });
}
function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}
/** What the browser does when it is idle. */
async function beIdle() {
  const waiting = idle.splice(0);
  for (const entry of waiting) entry.run();
  await vi.dynamicImportSettled();
}

beforeEach(() => {
  prepare.mockClear();
  idle = [];
  Object.defineProperty(navigator, "gpu", {
    value: { requestAdapter: () => Promise.resolve(null) },
    configurable: true,
  });
  vi.stubGlobal(
    "requestIdleCallback",
    (run: IdleCallback, options?: { timeout?: number }) => {
      idle.push({ run, options });
      return idle.length;
    },
  );
  vi.stubGlobal("cancelIdleCallback", () => undefined);
  setReadyState("complete");
  setHidden(false);
});
afterEach(() => {
  // Unmount while the globals the cleanup calls are still there.
  cleanup();
  Reflect.deleteProperty(navigator, "gpu");
  Reflect.deleteProperty(document, "readyState");
  Reflect.deleteProperty(document, "hidden");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("preparing the orb ahead of the first open", () => {
  it("waits for an idle moment, with a timeout of about two seconds, then prepares once", async () => {
    scheduleOrbPreparation();
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
    expect(idle).toHaveLength(1);
    expect(idle[0]?.options?.timeout).toBe(2000);
    await beIdle();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("waits for the window's load event first", async () => {
    setReadyState("loading");
    scheduleOrbPreparation();
    expect(idle).toHaveLength(0);
    setReadyState("complete");
    window.dispatchEvent(new Event("load"));
    expect(idle).toHaveLength(1);
    await beIdle();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("uses a timer where the browser has no idle callback", async () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    scheduleOrbPreparation();
    await vi.advanceTimersByTimeAsync(1900);
    expect(prepare).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await vi.dynamicImportSettled();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("never prepares in a hidden tab, and does once the tab is shown", async () => {
    setHidden(true);
    scheduleOrbPreparation();
    expect(idle).toHaveLength(0);
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await beIdle();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("does not prepare if the tab was hidden while it waited for the idle moment", async () => {
    scheduleOrbPreparation();
    setHidden(true);
    await beIdle();
    expect(prepare).not.toHaveBeenCalled();
    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await beIdle();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("does nothing under reduced motion", async () => {
    reduceMotion();
    scheduleOrbPreparation();
    expect(idle).toHaveLength(0);
    await beIdle();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does nothing where the browser has no WebGPU, and fetches nothing", async () => {
    Reflect.deleteProperty(navigator, "gpu");
    scheduleOrbPreparation();
    expect(idle).toHaveLength(0);
    await beIdle();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("can be cancelled before the idle moment", async () => {
    const cancel = scheduleOrbPreparation();
    cancel();
    window.dispatchEvent(new Event("load"));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
  });
});

function Bar({ available }: { available: boolean }) {
  usePrepareOrbAhead(available);
  return (
    <>
      <button type="button" id="spark-button">
        Spark
      </button>
      <button type="button">Search</button>
    </>
  );
}

describe("where Spark is available", () => {
  it("prepares ahead when it is, and prepares nothing when it is not", async () => {
    const off = render(<Bar available={false} />);
    await beIdle();
    expect(idle).toHaveLength(0);
    expect(prepare).not.toHaveBeenCalled();
    off.unmount();
    render(<Bar available />);
    await beIdle();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a pointer reaches the Spark button", "pointerOver"],
    ["focus goes to the Spark button", "focus"],
  ] as const)("prepares at once when %s", async (_name, how) => {
    render(<Bar available />);
    const button = screen.getByRole("button", { name: "Spark" });
    if (how === "focus") fireEvent.focusIn(button);
    else fireEvent.pointerOver(button);
    await vi.dynamicImportSettled();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("does not prepare for any other control, or when the hand reaches Spark in a hidden tab", async () => {
    render(<Bar available />);
    fireEvent.pointerOver(screen.getByRole("button", { name: "Search" }));
    setHidden(true);
    fireEvent.pointerOver(screen.getByRole("button", { name: "Spark" }));
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does not prepare for the Spark button where Spark is not available", async () => {
    render(<Bar available={false} />);
    fireEvent.pointerOver(screen.getByRole("button", { name: "Spark" }));
    await vi.dynamicImportSettled();
    expect(prepare).not.toHaveBeenCalled();
  });
});
