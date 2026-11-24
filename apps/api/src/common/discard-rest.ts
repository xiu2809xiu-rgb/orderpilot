import type { Readable } from "node:stream";

export interface DiscardOptions {
  /** More than this many further bytes, and the connection is dropped. */
  readonly maxBytes: number;
  /** The longest the rest of the body may take to arrive. */
  readonly timeoutMs: number;
}

/**
 * Throws away what is left of a request body that was refused. Dropping the
 * connection at once would reset it before a client that is still sending
 * could read the answer (the 413), and leaving it unread would hold the
 * connection until the server's own long timeout. So the rest is read and
 * discarded, within a byte budget and a time budget, and the connection is
 * dropped only if either runs out.
 *
 * `readBoundedBody` reads a request through its async iterator and never
 * returns it, so that iterator's `readable` listener is still on the request,
 * and a stream with one stays paused whatever `resume()` and a `data` listener
 * say. Removing the `readable` listeners is what lets the rest flow. Closing
 * the iterator instead would destroy the request at once, which is the reset
 * this function exists to avoid.
 */
export function discardRest(request: Readable, options: DiscardOptions): void {
  request.removeAllListeners("readable");
  let seen = 0;
  const timer = setTimeout(() => {
    request.destroy();
  }, options.timeoutMs);
  // A pending timer must never keep the process alive.
  timer.unref();
  const done = (): void => {
    clearTimeout(timer);
  };
  request.on("data", (chunk: Buffer) => {
    seen += chunk.length;
    if (seen > options.maxBytes) request.destroy();
  });
  request.on("end", done);
  request.on("close", done);
  request.on("error", done);
  request.resume();
}
