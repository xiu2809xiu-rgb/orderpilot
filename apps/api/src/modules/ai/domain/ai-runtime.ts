/**
 * The clock, the dice and the waiting of a gateway call, passed in so a test
 * sees exact delays and never waits. Production uses `systemRuntime`.
 */
export interface AiRuntime {
  /** Milliseconds since the epoch. */
  now(): number;
  /** A number in [0, 1), for the jitter of a retry wait. */
  random(): number;
  /** Resolves after `ms`, or rejects with the signal's reason when it fires first. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

/** Why a signal fired, as an Error, so a rejection with it is always an Error. */
export function reasonOf(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("The call was cancelled.");
}

export const systemRuntime: AiRuntime = {
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: (ms, signal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(reasonOf(signal));
        return;
      }
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(reasonOf(signal));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      signal.addEventListener("abort", onAbort, { once: true });
    }),
};
