// Reads a request body up to a size and a time limit. It is a helper and not a
// body parser on purpose: the guards run before a controller's handler, so
// nothing is read for a caller who is refused, which a parser registered for
// the whole app could not promise (ADR 0069).

/** The body is larger than the limit: by its declared length, or by the bytes that arrived. */
export class BodyTooLargeError extends Error {
  constructor() {
    super("The body is larger than the limit.");
    this.name = "BodyTooLargeError";
  }
}

/** The source failed, ended before the length it declared, or sent something that is not bytes. */
export class BodyCutOffError extends Error {
  constructor() {
    super("The body was cut off.");
    this.name = "BodyCutOffError";
  }
}

/** The whole body did not arrive in time: a trickle of bytes cannot hold a connection. */
export class BodyTimeoutError extends Error {
  constructor() {
    super("The body took too long to arrive.");
    this.name = "BodyTimeoutError";
  }
}

/**
 * A real 256 KB body arrives in a few dozen chunks. Many more than this is a
 * client sending tiny chunks to make the server hold one Buffer, and one
 * reaction on the deadline promise, for each (a body of 1-byte chunks costs
 * over 100 MB of heap), so it is refused as too large.
 */
export const MAX_BODY_CHUNKS = 4096;

export interface BoundedBodyOptions {
  readonly maxBytes: number;
  /** The whole read, not the gap between chunks. */
  readonly timeoutMs: number;
  /** The Content-Length the caller sent, when it sent one. Over the limit is refused before a byte is read. */
  readonly declaredLength?: number;
}

/**
 * The source is typed `unknown` and not `Uint8Array` because a Node request's
 * async iterator yields `any`: a chunk is narrowed here, and anything that is
 * not a Buffer or a Uint8Array is a cut-off body.
 *
 * Bytes are counted as they arrive, so a chunked body and a lying
 * Content-Length are stopped at the first byte past the limit. The source is
 * left where it stopped: closing a request's stream would drop the connection
 * before the caller could answer 413, so what to do with the rest is the
 * caller's.
 */
export async function readBoundedBody(
  source: AsyncIterable<unknown>,
  options: BoundedBodyOptions,
): Promise<Buffer> {
  const { maxBytes, timeoutMs, declaredLength } = options;
  if (declaredLength !== undefined && declaredLength > maxBytes) {
    throw new BodyTooLargeError();
  }

  const iterator = source[Symbol.asyncIterator]();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new BodyTimeoutError());
    }, timeoutMs);
  });

  try {
    for (;;) {
      const pending = iterator.next();
      // If the timer wins, this call is abandoned: its late failure is not ours to report.
      pending.catch(() => undefined);
      const step = await Promise.race([pending, expired]).catch(
        (error: unknown) => {
          if (error instanceof BodyTimeoutError) throw error;
          throw new BodyCutOffError();
        },
      );
      if (step.done === true) break;
      const chunk: unknown = step.value;
      if (!(chunk instanceof Uint8Array)) throw new BodyCutOffError();
      total += chunk.length;
      if (total > maxBytes) throw new BodyTooLargeError();
      if (chunks.length >= MAX_BODY_CHUNKS) throw new BodyTooLargeError();
      chunks.push(chunk);
    }
  } finally {
    clearTimeout(timer);
  }

  if (declaredLength !== undefined && total < declaredLength) {
    throw new BodyCutOffError();
  }
  return Buffer.concat(chunks, total);
}
