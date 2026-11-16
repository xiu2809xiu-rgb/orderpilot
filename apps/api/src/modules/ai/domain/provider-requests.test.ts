import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiCallMeter } from "./ai-call-meter.js";
import { AiProviderError } from "./ai-errors.js";
import type { AiRuntime } from "./ai-runtime.js";
import type {
  AiStepRequest,
  AiStepResult,
  AiStreamPart,
} from "./llm-provider.js";
import { ProviderRequests } from "./provider-requests.js";
import { RetryPolicy } from "./retry-policy.js";

const request: AiStepRequest = {
  feature: "spark",
  promptVersion: "v1",
  instructions: "Answer.",
  messages: [{ role: "user", parts: [{ type: "text", text: "Hi" }] }],
  tools: [],
  maxOutputTokens: 64,
};

const answer: AiStepResult = {
  text: "ok",
  toolCalls: [],
  inputTokens: 3,
  outputTokens: 2,
  finishReason: "stop",
};

/** Records every wait instead of making it. */
class FakeRuntime implements AiRuntime {
  readonly waits: number[] = [];
  now(): number {
    return 0;
  }
  random(): number {
    return 0.5;
  }
  sleep(ms: number): Promise<void> {
    this.waits.push(ms);
    return Promise.resolve();
  }
}

type Behaviour = AiStepResult | Error | "hang" | "hang-until-abort";

/** Plays one behaviour per request, in order, and remembers the signals it was given. */
class FakeProvider {
  readonly signals: AbortSignal[] = [];
  calls = 0;

  constructor(private readonly behaviours: readonly Behaviour[]) {}

  step(_request: AiStepRequest, signal: AbortSignal): Promise<AiStepResult> {
    this.signals.push(signal);
    const behaviour =
      this.behaviours[Math.min(this.calls, this.behaviours.length - 1)];
    this.calls += 1;
    if (behaviour === "hang") return new Promise(() => undefined);
    if (behaviour === "hang-until-abort") {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    if (behaviour instanceof Error) return Promise.reject(behaviour);
    return Promise.resolve(behaviour ?? answer);
  }

  async *stream(
    _request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiStreamPart> {
    this.signals.push(signal);
    const behaviour =
      this.behaviours[Math.min(this.calls, this.behaviours.length - 1)];
    this.calls += 1;
    await Promise.resolve();
    if (behaviour instanceof Error) throw behaviour;
    if (behaviour === "hang") await new Promise(() => undefined);
    yield { type: "text-delta", text: "he" };
    if (behaviour === "hang-until-abort") {
      throw new AiProviderError("provider-http-503");
    }
    yield { type: "text-delta", text: "llo" };
    yield {
      type: "finish",
      inputTokens: 1,
      outputTokens: 1,
      finishReason: "stop",
    };
  }
}

function build(
  provider: Pick<FakeProvider, "step" | "stream">,
  options: { maxAttempts?: number; timeoutMs?: number } = {},
) {
  const runtime = new FakeRuntime();
  const meter = new AiCallMeter();
  const requests = new ProviderRequests({
    provider,
    meter,
    runtime,
    retry: new RetryPolicy(),
    timeoutMs: options.timeoutMs ?? 5_000,
    maxAttempts: options.maxAttempts ?? 3,
  });
  return { requests, runtime, meter };
}

const never = new AbortController().signal;

async function collect(parts: AsyncIterable<AiStreamPart>) {
  const seen: AiStreamPart[] = [];
  for await (const part of parts) seen.push(part);
  return seen;
}

describe("provider requests: a step", () => {
  it("tries again after a failure that may pass, waits the policy's time, and counts every request", async () => {
    const provider = new FakeProvider([
      AiProviderError.fromHttpStatus(503),
      AiProviderError.fromHttpStatus(429),
      answer,
    ]);
    const h = build(provider);
    await expect(h.requests.step(request, never)).resolves.toBe(answer);
    expect(provider.calls).toBe(3);
    expect(h.meter.requests).toBe(3);
    // 500 and 1000 ms, then cut to between half and all by a random of 0.5.
    expect(h.runtime.waits).toEqual([375, 750]);
  });

  it("respects the provider's own wait hint, up to its cap", async () => {
    const provider = new FakeProvider([
      AiProviderError.fromHttpStatus(429, 2_000),
      AiProviderError.fromHttpStatus(429, 9_000_000),
      answer,
    ]);
    const h = build(provider);
    await h.requests.step(request, never);
    expect(h.runtime.waits).toEqual([2_000, 30_000]);
  });

  it.each([400, 401, 403, 404])(
    "does not try again after a %i, which would fail the same way",
    async (status) => {
      const failure = AiProviderError.fromHttpStatus(status);
      const provider = new FakeProvider([failure, answer]);
      const h = build(provider);
      await expect(h.requests.step(request, never)).rejects.toBe(failure);
      expect(provider.calls).toBe(1);
      expect(h.runtime.waits).toEqual([]);
    },
  );

  it("gives up after the attempts, with the last failure", async () => {
    const last = AiProviderError.fromHttpStatus(502);
    const provider = new FakeProvider([
      AiProviderError.fromHttpStatus(500),
      AiProviderError.fromHttpStatus(503),
      last,
      answer,
    ]);
    const h = build(provider, { maxAttempts: 3 });
    await expect(h.requests.step(request, never)).rejects.toBe(last);
    expect(provider.calls).toBe(3);
  });

  it("times out a provider that ignores its signal, as a timeout, and does not try again", async () => {
    const provider = new FakeProvider(["hang", answer]);
    const h = build(provider, { timeoutMs: 15 });
    const failure: unknown = await h.requests
      .step(request, never)
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(AiProviderError);
    expect(failure).toMatchObject({
      reasonCode: "provider-timeout",
      outcome: "timeout",
    });
    expect(provider.calls).toBe(1);
    expect(provider.signals[0]?.aborted).toBe(true);
  });

  it("calls an abort that our own timer caused a timeout, whatever the provider threw", async () => {
    const provider = new FakeProvider(["hang-until-abort"]);
    const h = build(provider, { timeoutMs: 15 });
    await expect(h.requests.step(request, never)).rejects.toMatchObject({
      reasonCode: "provider-timeout",
    });
  });

  it("stops at once when the call itself was cancelled, and does not try again", async () => {
    const controller = new AbortController();
    const provider = new FakeProvider([
      AiProviderError.fromHttpStatus(503),
      answer,
    ]);
    const h = build(provider);
    controller.abort();
    await expect(h.requests.step(request, controller.signal)).rejects.toThrow();
    expect(provider.calls).toBe(0);
    expect(h.meter.requests).toBe(0);
  });

  it("passes a failure it does not know through unchanged, for the gateway to name", async () => {
    const odd = new TypeError("a bug in an adapter");
    const h = build(new FakeProvider([odd]));
    await expect(h.requests.step(request, never)).rejects.toBe(odd);
  });

  it("does not accept fewer than one attempt", () => {
    expect(() => build(new FakeProvider([answer]), { maxAttempts: 0 })).toThrow(
      RangeError,
    );
  });
});

describe("provider requests: a stream", () => {
  it("tries again when the failure comes before the first part", async () => {
    const provider = new FakeProvider([
      AiProviderError.fromHttpStatus(503),
      answer,
    ]);
    const h = build(provider);
    const seen = await collect(h.requests.stream(request, never));
    expect(seen.map((part) => part.type)).toEqual([
      "text-delta",
      "text-delta",
      "finish",
    ]);
    expect(h.meter.requests).toBe(2);
    expect(h.runtime.waits).toEqual([375]);
  });

  it("does not try again once a part has reached the caller, so nothing is said twice", async () => {
    const provider = new FakeProvider(["hang-until-abort", answer]);
    const h = build(provider);
    const seen: AiStreamPart[] = [];
    await expect(
      (async () => {
        for await (const part of h.requests.stream(request, never)) {
          seen.push(part);
        }
      })(),
    ).rejects.toMatchObject({ reasonCode: "provider-http-503" });
    expect(seen).toEqual([{ type: "text-delta", text: "he" }]);
    expect(provider.calls).toBe(1);
  });

  it("times out a stream that stalls", async () => {
    const provider = new FakeProvider(["hang"]);
    const h = build(provider, { timeoutMs: 15 });
    await expect(
      collect(h.requests.stream(request, never)),
    ).rejects.toMatchObject({
      reasonCode: "provider-timeout",
    });
  });

  it("cancels the request in flight when the consumer stops reading", async () => {
    const provider = new FakeProvider([answer]);
    const h = build(provider);
    for await (const part of h.requests.stream(request, never)) {
      expect(part.type).toBe("text-delta");
      break;
    }
    expect(provider.signals[0]?.aborted).toBe(true);
    expect(h.meter.requests).toBe(1);
  });
});

/** Waits on the (fake) clock, so a test decides exactly how long each part takes. */
const later = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A stream whose parts arrive after the given gaps; a step that answers after its own gap. */
class SlowProvider {
  constructor(private readonly gapsMs: readonly number[]) {}

  async step(): Promise<AiStepResult> {
    await later(this.gapsMs[0] ?? 0);
    return answer;
  }

  async *stream(): AsyncIterable<AiStreamPart> {
    for (const gap of this.gapsMs) {
      await later(gap);
      yield { type: "text-delta", text: "x" };
    }
    yield {
      type: "finish",
      inputTokens: 1,
      outputTokens: 1,
      finishReason: "stop",
    };
  }
}

/** Counts the requests made to a provider it wraps. */
class FakeProviderOf {
  calls = 0;
  constructor(private readonly inner: Pick<FakeProvider, "step" | "stream">) {}
  step(r: AiStepRequest, signal: AbortSignal): Promise<AiStepResult> {
    this.calls += 1;
    return this.inner.step(r, signal);
  }
  stream(r: AiStepRequest, signal: AbortSignal): AsyncIterable<AiStreamPart> {
    this.calls += 1;
    return this.inner.stream(r, signal);
  }
}

describe("provider requests: the timeouts, on a fake clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Reads a stream to its end, noting the clock after each part. */
  async function drain(
    parts: AsyncIterable<AiStreamPart>,
    seen: AiStreamPart[],
    useMs = 0,
  ): Promise<void> {
    for await (const part of parts) {
      seen.push(part);
      if (useMs > 0) await later(useMs);
    }
  }

  it("never cuts a stream that is still arriving, however long it runs in all", async () => {
    // Six parts, 400 ms apart: 2.4 s in all against a 500 ms timeout.
    const h = build(
      new FakeProviderOf(new SlowProvider([400, 400, 400, 400, 400])),
      {
        timeoutMs: 500,
      },
    );
    const seen: AiStreamPart[] = [];
    const done = drain(h.requests.stream(request, never), seen);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(done).resolves.toBeUndefined();
    expect(seen).toHaveLength(6);
  });

  it("times out a stream that goes silent after its first part", async () => {
    const h = build(new FakeProviderOf(new SlowProvider([100, 800])), {
      timeoutMs: 500,
    });
    const seen: AiStreamPart[] = [];
    const done = drain(h.requests.stream(request, never), seen).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toMatchObject({ reasonCode: "provider-timeout" });
    expect(seen).toHaveLength(1);
  });

  it("times out a stream that never sends its first part, and does not try again", async () => {
    const provider = new FakeProviderOf(new SlowProvider([800]));
    const h = build(provider, { timeoutMs: 500 });
    const done = drain(h.requests.stream(request, never), []).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toMatchObject({ reasonCode: "provider-timeout" });
    expect(provider.calls).toBe(1);
  });

  it("does not count the time a slow reader takes as the provider's silence", async () => {
    // The reader spends 2 s on each part; the provider is quick.
    const h = build(new FakeProviderOf(new SlowProvider([10, 10, 10])), {
      timeoutMs: 500,
    });
    const seen: AiStreamPart[] = [];
    const done = drain(h.requests.stream(request, never), seen, 2_000);
    await vi.advanceTimersByTimeAsync(20_000);
    await expect(done).resolves.toBeUndefined();
    expect(seen).toHaveLength(4);
  });

  it("keeps one timeout for the whole of a plain request", async () => {
    const h = build(new FakeProviderOf(new SlowProvider([800])), {
      timeoutMs: 500,
    });
    const done = h.requests.step(request, never).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await done).toMatchObject({ reasonCode: "provider-timeout" });
  });

  it("lets a plain request that finishes inside its timeout answer", async () => {
    const h = build(new FakeProviderOf(new SlowProvider([400])), {
      timeoutMs: 500,
    });
    const done = h.requests.step(request, never);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(done).resolves.toBe(answer);
  });
});
