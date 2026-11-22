import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A local server that speaks the chat completions API, for the tests of the AI
 * providers. It answers from a queue of scripted replies, one per request, and
 * records every request it was sent, so a test can read exactly what a
 * provider put on the wire. It listens on the loopback address only.
 */

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  /** The body, parsed. Null when it was not JSON. */
  readonly body: unknown;
}

export interface FakeToolCall {
  readonly id: string;
  readonly name: string;
  /** The arguments as the model wrote them: a JSON string, valid or not. */
  readonly arguments: string;
}

export interface FakeUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
}

export type FakeReply =
  | {
      readonly kind: "completion";
      readonly content?: string | null;
      readonly toolCalls?: readonly FakeToolCall[];
      readonly finishReason?: string;
      readonly usage?: FakeUsage;
    }
  | {
      readonly kind: "stream";
      /** The text deltas, in order. */
      readonly deltas?: readonly string[];
      readonly toolCalls?: readonly FakeToolCall[];
      readonly finishReason?: string;
      readonly usage?: FakeUsage;
    }
  | {
      readonly kind: "status";
      readonly status: number;
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: string;
    }
  | { readonly kind: "raw"; readonly status?: number; readonly body: string }
  | { readonly kind: "hang" };

function usageJson(usage: FakeUsage): unknown {
  return {
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.promptTokens + usage.completionTokens,
  };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function sseLine(data: unknown): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

function chunk(delta: unknown, finishReason: string | null): unknown {
  return {
    id: "chatcmpl-fake",
    object: "chat.completion.chunk",
    created: 1,
    model: "fake",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

function sendStream(
  response: ServerResponse,
  reply: Extract<FakeReply, { kind: "stream" }>,
): void {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
  });
  response.write(sseLine(chunk({ role: "assistant", content: "" }, null)));
  for (const delta of reply.deltas ?? []) {
    response.write(sseLine(chunk({ content: delta }, null)));
  }
  (reply.toolCalls ?? []).forEach((call, index) => {
    // The id and the name come first, the arguments in two pieces, as a real server does.
    const half = Math.ceil(call.arguments.length / 2);
    response.write(
      sseLine(
        chunk(
          {
            tool_calls: [
              {
                index,
                id: call.id,
                type: "function",
                function: {
                  name: call.name,
                  arguments: call.arguments.slice(0, half),
                },
              },
            ],
          },
          null,
        ),
      ),
    );
    response.write(
      sseLine(
        chunk(
          {
            tool_calls: [
              {
                index,
                function: { arguments: call.arguments.slice(half) },
              },
            ],
          },
          null,
        ),
      ),
    );
  });
  response.write(
    sseLine(
      chunk(
        {},
        reply.finishReason ??
          ((reply.toolCalls?.length ?? 0) > 0 ? "tool_calls" : "stop"),
      ),
    ),
  );
  if (reply.usage !== undefined) {
    response.write(
      sseLine({
        id: "chatcmpl-fake",
        object: "chat.completion.chunk",
        created: 1,
        model: "fake",
        choices: [],
        usage: usageJson(reply.usage),
      }),
    );
  }
  response.write(sseLine("[DONE]"));
  response.end();
}

export class FakeChatServer {
  readonly requests: RecordedRequest[] = [];
  private readonly queue: FakeReply[] = [];
  private readonly open = new Set<ServerResponse>();

  private constructor(
    private readonly server: Server,
    /** The base URL of the API, with its /v1 prefix and no trailing slash. */
    readonly baseUrl: string,
  ) {}

  static async start(): Promise<FakeChatServer> {
    let fake: FakeChatServer | null = null;
    const server = createServer((request, response) => {
      void fake?.handle(request, response);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    fake = new FakeChatServer(server, `http://127.0.0.1:${String(port)}/v1`);
    return fake;
  }

  /** Queues the answer to the next request. */
  reply(...replies: FakeReply[]): this {
    this.queue.push(...replies);
    return this;
  }

  get lastRequest(): RecordedRequest {
    const last = this.requests.at(-1);
    if (last === undefined) throw new Error("The fake server got no request.");
    return last;
  }

  async close(): Promise<void> {
    for (const response of this.open) response.destroy();
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const text = await readBody(request);
    this.requests.push({
      method: request.method ?? "",
      path: request.url ?? "",
      headers: request.headers,
      body: parseJson(text),
    });
    const reply = this.queue.shift();
    if (reply === undefined) {
      sendJson(response, 500, { error: { message: "No reply was queued." } });
      return;
    }
    switch (reply.kind) {
      case "completion":
        sendJson(response, 200, {
          id: "chatcmpl-fake",
          object: "chat.completion",
          created: 1,
          model: "fake",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: reply.content ?? null,
                ...(reply.toolCalls === undefined
                  ? {}
                  : {
                      tool_calls: reply.toolCalls.map((call) => ({
                        id: call.id,
                        type: "function",
                        function: {
                          name: call.name,
                          arguments: call.arguments,
                        },
                      })),
                    }),
              },
              finish_reason:
                reply.finishReason ??
                ((reply.toolCalls?.length ?? 0) > 0 ? "tool_calls" : "stop"),
            },
          ],
          ...(reply.usage === undefined
            ? {}
            : { usage: usageJson(reply.usage) }),
        });
        return;
      case "stream":
        sendStream(response, reply);
        return;
      case "status":
        response.writeHead(reply.status, {
          "content-type": "application/json",
          ...reply.headers,
        });
        response.end(reply.body ?? "{}");
        return;
      case "raw":
        response.writeHead(reply.status ?? 200, {
          "content-type": "application/json",
        });
        response.end(reply.body);
        return;
      case "hang":
        // Never answered: the test ends it with an abort or by closing the server.
        this.open.add(response);
        return;
    }
  }
}
