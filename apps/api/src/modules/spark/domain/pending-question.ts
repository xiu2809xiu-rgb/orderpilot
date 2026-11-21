/** The gateway's limits that decide how long one question can honestly take. */
export interface PendingLimits {
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly maxToolSteps: number;
}

/**
 * How long a question may wait for its answer before it counts as abandoned.
 * One answer can ask the provider once for every tool step and once more for
 * the final text, and each request may be tried again up to the attempt cap,
 * each try within the timeout. A question still waiting after all of that has
 * lost its process, and the thread would otherwise answer 409 for ever.
 */
export function pendingLimitMs(limits: PendingLimits): number {
  return limits.timeoutMs * limits.maxAttempts * (limits.maxToolSteps + 1);
}

/** True when a question asked at `askedAt` has waited past the limit. */
export function isAbandoned(
  askedAt: Date,
  now: Date,
  limits: PendingLimits,
): boolean {
  return now.getTime() - askedAt.getTime() > pendingLimitMs(limits);
}
