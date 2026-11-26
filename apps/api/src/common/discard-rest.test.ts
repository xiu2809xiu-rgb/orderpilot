import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discardRest } from "./discard-rest.js";

describe("discardRest", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads and throws away what is left, without destroying the stream", async () => {
    const stream = new PassThrough();
    discardRest(stream, { maxBytes: 1000, timeoutMs: 5000 });
    stream.write(Buffer.alloc(400));
    stream.write(Buffer.alloc(400));
    await new Promise((resolve) => setImmediate(resolve));
    // Eight hundred bytes arrived and were read: the stream is still open.
    expect(stream.destroyed).toBe(false);
    expect(stream.readableLength).toBe(0);
    stream.end();
  });

  it("drops the connection when more than the budget keeps coming", async () => {
    const stream = new PassThrough();
    discardRest(stream, { maxBytes: 1000, timeoutMs: 5000 });
    stream.write(Buffer.alloc(600));
    stream.write(Buffer.alloc(600));
    await new Promise((resolve) => stream.once("close", resolve));
    expect(stream.destroyed).toBe(true);
  });

  it("drops the connection when the rest takes too long, and not before", async () => {
    vi.useFakeTimers();
    const stream = new PassThrough();
    discardRest(stream, { maxBytes: 1000, timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(4999);
    expect(stream.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(stream.destroyed).toBe(true);
  });

  it("clears its timer when the body ends", async () => {
    vi.useFakeTimers();
    const stream = new PassThrough();
    discardRest(stream, { maxBytes: 1000, timeoutMs: 5000 });
    stream.end(Buffer.alloc(10));
    await vi.advanceTimersByTimeAsync(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
