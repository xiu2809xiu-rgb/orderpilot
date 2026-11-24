import { createServer, request as httpRequest } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { discardRest } from "./discard-rest.js";
import { BodyTooLargeError, readBoundedBody } from "./read-bounded-body.js";

const READ_LIMIT = 1_000;
const DISCARD_BUDGET = 200_000;

interface Trial {
  readonly status: number | undefined;
  /** What the server read from the socket after it had decided to refuse. */
  readonly readAfterRefusal: number;
}

let server: Server | undefined;

afterEach(async () => {
  const closing = server;
  server = undefined;
  if (closing === undefined) return;
  closing.closeAllConnections();
  await new Promise((resolve) => closing.close(resolve));
});

/**
 * The same sequence as the upload route over a real socket: read through the
 * request's async iterator, refuse as too large, answer 413, then discard.
 * A PassThrough cannot show this: only a real request keeps the `readable`
 * listener of the iterator that readBoundedBody leaves behind.
 */
function runTrial(): Promise<Trial> {
  return new Promise((resolve, reject) => {
    let status: number | undefined;
    let serverSide: number | undefined;
    let clientDone = false;
    // The client and the server share this process: report once both have seen the end.
    const settle = (): void => {
      if (serverSide === undefined || !clientDone) return;
      resolve({ status, readAfterRefusal: serverSide });
    };
    server = createServer((req, res) => {
      readBoundedBody(req, { maxBytes: READ_LIMIT, timeoutMs: 5_000 })
        .then(
          () => {
            throw new Error("the body should have been refused");
          },
          (error: unknown) => {
            if (!(error instanceof BodyTooLargeError)) throw error;
          },
        )
        .then(() => {
          const before = req.socket.bytesRead;
          discardRest(req, { maxBytes: DISCARD_BUDGET, timeoutMs: 1_500 });
          res.statusCode = 413;
          res.end();
          req.once("close", () => {
            serverSide = req.socket.bytesRead - before;
            settle();
          });
        })
        .catch(reject);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server?.address() as AddressInfo;
      const client = httpRequest({
        port,
        host: "127.0.0.1",
        method: "PUT",
        // A client that declares more than it ever should, and keeps sending.
        headers: { "content-length": String(8_000_000) },
      });
      client.on("response", (response) => {
        status = response.statusCode;
        response.resume();
        clientDone = true;
        settle();
      });
      client.on("error", () => {
        clientDone = true;
        settle();
      });
      const block = Buffer.alloc(64 * 1024, 1);
      // Paced, so the 413 reaches the client before the budget runs out: a
      // sender faster than that sees the reset first (the lead's "not doing" line).
      const send = (): void => {
        if (client.destroyed) return;
        client.write(block);
        setTimeout(send, 10);
      };
      send();
    });
  });
}

describe("discardRest on a real request after readBoundedBody", () => {
  it("reads and drops what is left, up to its budget, after the 413 went out", async () => {
    const trial = await runTrial();
    expect(trial.status).toBe(413);
    // Before the fix the paused stream was never read: 0 bytes after the 413.
    expect(trial.readAfterRefusal).toBeGreaterThan(DISCARD_BUDGET);
  }, 20_000);
});
