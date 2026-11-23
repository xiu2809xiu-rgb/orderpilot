import { vi } from "vitest";

/**
 * A WebGL2 context that accepts every call and says yes to every question
 * (compiled, linked), so the kit's orb can run in jsdom. Only tests import it.
 */
export function stubWebgl2() {
  const gl = new Proxy(
    {},
    { get: () => vi.fn(() => ({})) },
  ) as unknown as WebGL2RenderingContext;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (kind: string) {
      return kind === "webgl2" ? gl : null;
    } as HTMLCanvasElement["getContext"],
  );
  return gl;
}

/**
 * Takes over requestAnimationFrame so that a test steps the frames by hand,
 * instead of waiting for the browser's clock. `step` runs the callbacks that
 * are waiting, once each; a callback that asks for another frame waits for the
 * next `step`.
 */
export function manualFrames() {
  let queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = next;
    next += 1;
    queue.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue.delete(id);
  });
  return {
    step(at = 16) {
      const waiting = queue;
      queue = new Map();
      for (const callback of waiting.values()) callback(at);
    },
    get waiting() {
      return queue.size;
    },
  };
}

/**
 * Like `stubWebgl2`, and a 2D context that accepts every call too. The pixel
 * toggle's glass renderer draws its glyph mask with a 2D context, so it needs
 * both to come up in jsdom. `kinds` records which contexts were asked for.
 */
export function stubCanvasContexts() {
  const answer = () => new Proxy({}, { get: () => vi.fn(() => ({})) });
  const gl = answer() as unknown as WebGL2RenderingContext;
  const ctx = answer() as unknown as CanvasRenderingContext2D;
  const kinds: string[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (kind: string) {
      kinds.push(kind);
      if (kind === "webgl2") return gl;
      return kind === "2d" ? ctx : null;
    } as HTMLCanvasElement["getContext"],
  );
  return { gl, ctx, kinds };
}
