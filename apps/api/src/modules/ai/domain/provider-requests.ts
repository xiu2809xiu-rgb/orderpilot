import type { AiCallMeter } from "./ai-call-meter.js";
import { AiProviderError } from "./ai-errors.js";
import { reasonOf, type AiRuntime } from "./ai-runtime.js";
import type {
  AiStepRequest,
  AiStepResult,
  AiStreamPart,
  LlmProvider,
} from "./llm-provider.js";
import type { RetryPolicy } from "./retry-policy.js";

// What stands between the tool loop and the provider: one request at a time,
// each with its own timeout, counted on the call's meter, and tried again when
// the failure may pass on its own. A provider is written to honour its signal,
// but a slow or buggy one must not hold a call open, so the wait is raced
// against the signal here as well.

export interface ProviderRequestsDeps {
  readonly provider: Pick<LlmProvider, "step" | "stream">;
  readonly meter: AiCallMeter;
  readonly runtime: AiRuntime;
  readonly retry: RetryPolicy;
  /** Each provider request, retries included, gets this long. */
  readonly timeoutMs: number;
  /** The most times one request is tried. */
  readonly maxAttempts: number;
}

/** Settles with `promise`, or rejects as soon as `signal` fires, whichever is first. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  // The loser of the race must not become an unhandled rejection.
  promise.catch(() => undefined);
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(reasonOf(signal));
      return;
    }
    const onAbort = (): void => {
      reject(reasonOf(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        // A provider throws an Error; a bare value is a bug and loses its content here.
        reject(error instanceof Error ? error : new Error("Not an error."));
      },
    );
  });
}

/** One request's own signal: the call's cancel, plus the timeout. */
class RequestWindow {
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly onCallAbort: () => void;
  private expired = false;

  constructor(
    private readonly callSignal: AbortSignal,
    timeoutMs: number,
  ) {
    this.onCallAbort = () => {
      this.controller.abort(callSignal.reason);
    };
    callSignal.addEventListener("abort", this.onCallAbort, { once: true });
    this.timer = setTimeout(() => {
      this.expired = true;
      this.controller.abort();
    }, timeoutMs);
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** A failure caused by our own timeout is a timeout, whatever the provider threw. */
  explain(error: unknown): unknown {
    return this.expired ? AiProviderError.timeout() : error;
  }

  /** Ends the request. Aborting here also tells a provider still reading that nobody is listening. */
  close(): void {
    clearTimeout(this.timer);
    this.callSignal.removeEventListener("abort", this.onCallAbort);
    this.controller.abort();
  }
}

export class ProviderRequests implements Pick<LlmProvider, "step" | "stream"> {
  constructor(private readonly deps: ProviderRequestsDeps) {
    if (!Number.isInteger(deps.maxAttempts) || deps.maxAttempts < 1) {
      throw new RangeError("The attempts per request must be at least one.");
    }
  }

  async step(
    request: AiStepRequest,
    signal: AbortSignal,
  ): Promise<AiStepResult> {
    for (let attempt = 1; ; attempt += 1) {
      signal.throwIfAborted();
      this.deps.meter.addRequest();
      const window = new RequestWindow(signal, this.deps.timeoutMs);
      try {
        return await raceAbort(
          this.deps.provider.step(request, window.signal),
          window.signal,
        );
      } catch (error) {
        const failure = window.explain(error);
        if (!this.worthRetrying(failure, attempt, signal)) throw failure;
        await this.pause(failure, attempt, signal);
      } finally {
        window.close();
      }
    }
  }

  /**
   * A request is retried only before its first part reached the caller: after
   * that the caller has already read part of an answer, and a second try would
   * repeat it.
   */
  async *stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncGenerator<AiStreamPart> {
    for (let attempt = 1; ; attempt += 1) {
      signal.throwIfAborted();
      this.deps.meter.addRequest();
      const window = new RequestWindow(signal, this.deps.timeoutMs);
      let delivered = false;
      let iterator: AsyncIterator<AiStreamPart> | null = null;
      try {
        const parts = this.deps.provider.stream(request, window.signal);
        iterator = parts[Symbol.asyncIterator]();
        for (;;) {
          const next = await raceAbort(iterator.next(), window.signal);
          if (next.done === true) return;
          delivered = true;
          yield next.value;
        }
      } catch (error) {
        const failure = window.explain(error);
        if (delivered || !this.worthRetrying(failure, attempt, signal)) {
          throw failure;
        }
        await this.pause(failure, attempt, signal);
      } finally {
        window.close();
        // Not awaited: a provider stuck in a read would hold the caller too.
        void Promise.resolve(iterator?.return?.()).catch(() => undefined);
      }
    }
  }

  private worthRetrying(
    failure: unknown,
    attempt: number,
    signal: AbortSignal,
  ): boolean {
    return (
      !signal.aborted &&
      attempt < this.deps.maxAttempts &&
      this.deps.retry.isTransient(failure)
    );
  }

  private pause(
    failure: unknown,
    attempt: number,
    signal: AbortSignal,
  ): Promise<void> {
    return this.deps.runtime.sleep(
      this.deps.retry.delayMs(failure, attempt, () =>
        this.deps.runtime.random(),
      ),
      signal,
    );
  }
}
