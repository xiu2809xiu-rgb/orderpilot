/** The two facts of a workflow step this needs, as the workflow's record sends them. */
interface RecordedStep {
  state: string;
  completedAt?: string | null;
}

/**
 * When an order came to the step it is at now: the moment the workflow's record
 * marks its newest finished step done. A record with no finished step, or none
 * at all, has no answer, and the caller keeps the time it already had.
 */
export function stepBegan(
  steps: readonly RecordedStep[] | undefined,
): Date | undefined {
  let newest: number | null = null;
  for (const step of steps ?? []) {
    if (step.state !== "done" || !step.completedAt) continue;
    const at = Date.parse(step.completedAt);
    if (Number.isNaN(at)) continue;
    if (newest === null || at > newest) newest = at;
  }
  return newest === null ? undefined : new Date(newest);
}
