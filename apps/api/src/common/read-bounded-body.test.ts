import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BodyCutOffError,
  BodyTimeoutError,
  BodyTooLargeError,
  MAX_BODY_CHUNKS,
  readBoundedBody,
} from "./read-bounded-body.js";

/** A source of equal chunks that counts how many it was asked for. */
function chunked(sizes: number[]): {
  source: AsyncIterable<unknown>;
  pulled: () => number;
} {
  let pulled = 0;
  return {
    pulled: () => pulled,
    source: (async function* () {
      for (const size of sizes) {
        pulled += 1;
        yield Buffer.alloc(size, 7);
        await Promise.resolve();
      }
    })(),
  };
}

const LIMITS = { maxBytes: 250, timeoutMs: 15_000 };

describe("readBoundedBody", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads a body within the limit, joined in order", async () => {
    const source = (async function* () {
      await Promise.resolve();
      yield Buffer.from("abc");
      yield new Uint8Array([100, 101]);
    })();
    const body = await readBoundedBody(source, LIMITS);
    expect(body.toString()).toBe("abcde");
  });

  it("reads an empty body as no bytes", async () => {
    const body = await readBoundedBody(chunked([]).source, LIMITS);
    expect(body).toHaveLength(0);
  });

  it("refuses a declared length over the limit without reading a byte", async () => {
    const { source, pulled } = chunked([10, 10]);
    await expect(
      readBoundedBody(source, { ...LIMITS, declaredLength: 251 }),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(pulled()).toBe(0);
  });

  it("stops at the first chunk that passes the limit for a chunked source", async () => {
    const { source, pulled } = chunked([100, 100, 100, 100, 100, 100]);
    await expect(readBoundedBody(source, LIMITS)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
    // 100 + 100 + 100 is the first total over 250: nothing after is pulled.
    expect(pulled()).toBe(3);
  });

  it("stops a body that is larger than the length it declared", async () => {
    const { source } = chunked([200, 200]);
    await expect(
      readBoundedBody(source, { ...LIMITS, declaredLength: 100 }),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("refuses a body sent as thousands of tiny chunks, after the chunk cap", async () => {
    let pulled = 0;
    const source = (async function* () {
      for (let i = 0; i < 262_144; i += 1) {
        pulled += 1;
        yield Buffer.alloc(1, 7);
        await Promise.resolve();
      }
    })();
    await expect(
      readBoundedBody(source, { maxBytes: 262_144, timeoutMs: 15_000 }),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
    // The cap is hit on the pull after the 4,096th chunk was kept.
    expect(pulled).toBe(MAX_BODY_CHUNKS + 1);
  });

  it("accepts a body of exactly the limit", async () => {
    const body = await readBoundedBody(chunked([125, 125]).source, LIMITS);
    expect(body).toHaveLength(250);
  });

  it("reports a source that errors as cut off", async () => {
    const source = (async function* () {
      await Promise.resolve();
      yield Buffer.from("partial");
      throw new Error("socket closed");
    })();
    await expect(readBoundedBody(source, LIMITS)).rejects.toBeInstanceOf(
      BodyCutOffError,
    );
  });

  it("reports a body that ends before its declared length as cut off", async () => {
    await expect(
      readBoundedBody(chunked([10]).source, { ...LIMITS, declaredLength: 20 }),
    ).rejects.toBeInstanceOf(BodyCutOffError);
  });

  it("reports a chunk that is neither a Buffer nor a Uint8Array as cut off", async () => {
    for (const odd of ["text", 42, { length: 3 }, null]) {
      const source = (async function* () {
        await Promise.resolve();
        yield odd;
      })();
      await expect(readBoundedBody(source, LIMITS)).rejects.toBeInstanceOf(
        BodyCutOffError,
      );
    }
  });

  it("gives up on a source that stalls", async () => {
    vi.useFakeTimers();
    const stalled: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise<IteratorResult<unknown>>(() => undefined),
      }),
    };
    const outcome = readBoundedBody(stalled, LIMITS).catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(14_999);
    // Still waiting: the promise has not settled.
    const early = await Promise.race([outcome, Promise.resolve("waiting")]);
    expect(early).toBe("waiting");
    await vi.advanceTimersByTimeAsync(2);
    expect(await outcome).toBeInstanceOf(BodyTimeoutError);
  });

  it("clears its timer when the body arrives", async () => {
    vi.useFakeTimers();
    await readBoundedBody(chunked([5]).source, LIMITS);
    expect(vi.getTimerCount()).toBe(0);
  });
});
