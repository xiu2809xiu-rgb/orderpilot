import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HEADERS, type MyPicture } from "@orderpilot/shared";
import request from "supertest";
import { PrismaService } from "../../src/database/prisma.service.js";
import { API, type Browser } from "./auth.js";
import type { TestApp } from "./test-app.js";

export const MINE_PATH = `${API}/profile-pictures/mine`;

/** The checked-in flat 256 px JPEG: a colour square made in code. */
export const FLAT_JPEG = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/profile-picture-flat-256.jpg",
  ),
);

export interface PutOptions {
  /** The path to call, when not the picture route. */
  readonly path?: string;
  /** False sends no CSRF header; a string sends that value. Default: the browser's own. */
  readonly csrf?: boolean | string;
  /** Default image/jpeg. */
  readonly contentType?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** `PUT /profile-pictures/mine` as the page does it: a raw body, cookies and the CSRF header. */
export function putPicture(
  t: TestApp,
  browser: Browser | null,
  body: Buffer,
  options: PutOptions = {},
): request.Test {
  const path = options.path ?? MINE_PATH;
  const req = request(t.app.getHttpServer()).put(path);
  if (browser) {
    const cookies = browser.cookieHeader(path);
    if (cookies) req.set("Cookie", cookies);
    if (options.csrf !== false) {
      req.set(
        HEADERS.csrf,
        typeof options.csrf === "string" ? options.csrf : browser.csrf,
      );
    }
  }
  req.set("Content-Type", options.contentType ?? "image/jpeg");
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    req.set(name, value);
  }
  return req.send(body);
}

/**
 * A hand-written request, for the cases a client library will not send: a
 * Content-Length that is not the size of the body, and a body that stops
 * short. Resolves with the response's status line and body text, or with null
 * when the server closed the connection without one.
 */
export async function rawPut(
  t: TestApp,
  browser: Browser,
  options: {
    /** A Content-Length that may not be the size of the body. */
    readonly declaredLength?: number;
    readonly body?: Buffer;
    /** Sent in chunks with no Content-Length, then the closing chunk. */
    readonly chunks?: Buffer[];
    /** Close the connection after the body instead of waiting for an answer. */
    readonly hangUp?: boolean;
  },
): Promise<{ status: number; text: string } | null> {
  const server: Server = t.app.getHttpServer();
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
  }
  const { port } = server.address() as AddressInfo;
  const head = [
    `PUT ${MINE_PATH} HTTP/1.1`,
    "Host: 127.0.0.1",
    `Cookie: ${browser.cookieHeader(MINE_PATH)}`,
    `${HEADERS.csrf}: ${browser.csrf}`,
    "Content-Type: image/jpeg",
    options.chunks
      ? "Transfer-Encoding: chunked"
      : `Content-Length: ${String(options.declaredLength ?? 0)}`,
    "Connection: close",
    "",
    "",
  ].join("\r\n");
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    let received = "";
    socket.on("data", (chunk: Buffer) => {
      received += chunk.toString("latin1");
    });
    const giveUp = setTimeout(() => {
      socket.destroy();
    }, 4000);
    const finish = (): void => {
      clearTimeout(giveUp);
      const status = /^HTTP\/1\.1 (\d{3})/.exec(received);
      resolve(
        status
          ? {
              status: Number(status[1]),
              text: received.split("\r\n\r\n")[1] ?? "",
            }
          : null,
      );
    };
    socket.on("close", finish);
    socket.on("error", () => undefined);
    socket.write(head);
    if (options.chunks) {
      for (const chunk of options.chunks) {
        socket.write(`${chunk.length.toString(16)}\r\n`);
        socket.write(chunk);
        socket.write("\r\n");
      }
      socket.write("0\r\n\r\n");
    } else if (options.body) {
      socket.write(options.body);
    }
    if (options.hangUp) socket.end();
  });
}

export function prismaOf(t: TestApp): PrismaService["client"] {
  return t.app.get(PrismaService).client;
}

/** Every picture row, oldest first. */
export function pictureRows(t: TestApp) {
  return prismaOf(t).profilePicture.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

/** `GET /profile-pictures/mine` as one browser. */
export async function mineOf(t: TestApp, browser: Browser): Promise<MyPicture> {
  const res = await request(t.app.getHttpServer())
    .get(MINE_PATH)
    .set("Cookie", browser.cookieHeader(MINE_PATH));
  if (res.status !== 200)
    throw new Error(`mine answered ${String(res.status)}`);
  return (res.body as { data: MyPicture }).data;
}

/** A check that waits at a gate the test opens, and counts how often it was asked. */
export function gatedCheck() {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const state = { calls: 0 };
  const check = {
    check: async () => {
      state.calls += 1;
      await gate;
      return {
        aiStatus: "NOT_ALLOWED" as const,
        aiWhy: "synthetic-data-only",
        aiVerdict: null,
        aiConcerns: [],
        aiNote: null,
      };
    },
  };
  return {
    check,
    state,
    open: () => {
      open();
    },
  };
}

/** `GET /profile-pictures/:id/image` as one browser, or with no session. */
export function getImage(
  t: TestApp,
  browser: Browser | null,
  id: string,
  headers: Readonly<Record<string, string>> = {},
): request.Test {
  const path = `${API}/profile-pictures/${id}/image`;
  const req = request(t.app.getHttpServer())
    .get(path)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        // The picture is bytes; an error is the JSON envelope; a 304 has no body.
        if (String(res.headers["content-type"]).startsWith("image/jpeg")) {
          done(null, body);
        } else {
          done(null, body.length > 0 ? JSON.parse(body.toString()) : {});
        }
      });
    });
  if (browser) req.set("Cookie", browser.cookieHeader(path));
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
}
