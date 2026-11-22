import { AiProviderError } from "./ai-errors.js";

// When to try a provider request again, and how long to wait. Pure: the random
// source is passed in, so a test sees exact delays and never waits.

export interface RetryTimings {
  /** The wait before the first retry. It doubles each time. */
  readonly baseDelayMs: number;
  /** No computed wait is longer than this. */
  readonly maxDelayMs: number;
  /** A provider's own retry-after hint is respected up to this. */
  readonly maxRetryAfterMs: number;
}

export const DEFAULT_RETRY_TIMINGS: RetryTimings = {
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  maxRetryAfterMs: 30_000,
};

const HTTP_REASON_PREFIX = "provider-http-";

/** The status a reason code such as "provider-http-429" carries, or null. */
function statusOf(reasonCode: string): number | null {
  if (!reasonCode.startsWith(HTTP_REASON_PREFIX)) return null;
  const digits = reasonCode.slice(HTTP_REASON_PREFIX.length);
  return /^\d{3}$/.test(digits) ? Number(digits) : null;
}

export class RetryPolicy {
  constructor(private readonly timings: RetryTimings = DEFAULT_RETRY_TIMINGS) {}

  /**
   * A failure that may pass on its own: no connection, a busy provider (408,
   * 425, 429) or a provider fault (5xx). A 400, 401 or 403 will fail the same
   * way again, and a timeout is not retried because a slow model is slow again
   * and the wait would be a minute each time.
   */
  isTransient(error: unknown): boolean {
    if (!(error instanceof AiProviderError)) return false;
    if (error.reasonCode === "provider-network") return true;
    const status = statusOf(error.reasonCode);
    if (status === null) return false;
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  /**
   * The wait before retry number `retry` (1 for the first). With a provider
   * hint, the hint up to its cap. Otherwise a doubling wait up to the cap, cut
   * to between half and all of it by `random()` so that many callers do not
   * return together.
   */
  delayMs(error: unknown, retry: number, random: () => number): number {
    const hint = error instanceof AiProviderError ? error.retryAfterMs : null;
    if (hint !== null) {
      return Math.min(
        Math.max(0, Math.round(hint)),
        this.timings.maxRetryAfterMs,
      );
    }
    const doubled = this.timings.baseDelayMs * 2 ** Math.max(0, retry - 1);
    const capped = Math.min(doubled, this.timings.maxDelayMs);
    return Math.round(capped / 2 + (capped / 2) * random());
  }
}
