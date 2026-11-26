export type DeadlineResult<T> =
  { readonly done: true; readonly value: T } | { readonly done: false };

/**
 * Waits for `work` for at most `ms`. A call that cannot be cancelled keeps
 * running after the deadline: its late answer, or its late failure, is thrown
 * away, and the timer is always cleared. A failure before the deadline is the
 * caller's to handle.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
): Promise<DeadlineResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<DeadlineResult<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve({ done: false });
    }, ms);
  });
  // If the deadline wins, the work's own failure must not go unhandled.
  work.catch(() => undefined);
  try {
    return await Promise.race([
      work.then((value): DeadlineResult<T> => ({ done: true, value })),
      late,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
