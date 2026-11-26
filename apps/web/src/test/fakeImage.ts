import { vi } from "vitest";

/**
 * jsdom never loads an image, so Radix's avatar would show its fallback for
 * ever. This stands in for `window.Image`: it says "loaded" or "failed" on the
 * next tick, the way a browser does, and a test chooses which.
 */
export function stubImage(outcome: "load" | "fail"): void {
  class FakeImage extends EventTarget {
    complete = false;
    naturalWidth = 0;
    referrerPolicy = "";
    crossOrigin: string | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = outcome === "load" ? 256 : 0;
        this.dispatchEvent(new Event(outcome === "load" ? "load" : "error"));
      });
    }
  }
  vi.stubGlobal("Image", FakeImage);
}
