/** The three facts of a workflow step this needs, as the workflow's record sends them. */
interface RecordedStep {
  key: string;
  state: string;
  completedAt?: string | null;
}

/**
 * The step of the journey's nine (1 to 9, the tracker's order) that each step
 * of the workflow's record finishes. It follows the mapping of task kinds in
 * `screens/home/timelineModel.ts`: confirming the fields belongs to taking in
 * the PO, an SPR approval to the stock step, and both the invoice and the
 * shipping documents to the documents step, which is where Home puts the task
 * that adds them. Packing is step 5. A key that is not here is not a step this
 * page can place, so it is ignored: the record may gain steps before this does.
 */
const POSITION_OF_STEP: ReadonlyMap<string, number> = new Map([
  ["po-received", 1],
  ["fields-confirmed", 1],
  ["stock-checked", 2],
  ["spr-approval", 2],
  ["pi-sent", 3],
  ["payment-confirmed", 4],
  ["packed", 5],
  ["invoiced", 6],
  ["shipping-documents", 6],
]);

/**
 * When an order came to the step it is at now: the moment the newest finished
 * step of the workflow's record that lies before that step was done. A step
 * at the current step or after it never counts, because an act that finishes
 * one of those (a payment confirmed while the tracker still says "waiting for
 * payment") does not move the order to where the tracker has it, and the wait
 * must not start again with it. `current` is the tracker's step, 1 to 9, or
 * 10 for an order whose every step is done. A record with no such step has no
 * answer, and the caller keeps the time it already had.
 */
export function stepBegan(
  steps: readonly RecordedStep[] | undefined,
  current: number | null,
): Date | undefined {
  if (current === null) return undefined;
  let newest: number | null = null;
  for (const step of steps ?? []) {
    if (step.state !== "done" || !step.completedAt) continue;
    const position = POSITION_OF_STEP.get(step.key);
    if (position === undefined || position >= current) continue;
    const at = Date.parse(step.completedAt);
    if (Number.isNaN(at)) continue;
    if (newest === null || at > newest) newest = at;
  }
  return newest === null ? undefined : new Date(newest);
}
