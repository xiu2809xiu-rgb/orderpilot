import {
  formatRecordNumber,
  type RecordNumber,
  type RecordType,
} from "@orderpilot/shared";

/**
 * OrderPilot's own numbers in the shared format (`SPR-20261102-0001`): a
 * prefix, the day, and a running number that starts again each day for each
 * type. One counter serves the whole dataset, so no number is used twice.
 */
export class RecordNumberer {
  private readonly counts = new Map<string, number>();

  next(type: RecordType, date: string): RecordNumber {
    const key = `${type}-${date}`;
    const sequence = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, sequence);
    // Ten in the morning in Singapore, so the day cannot slip across midnight.
    return formatRecordNumber(
      type,
      new Date(`${date}T02:00:00.000Z`),
      sequence,
    );
  }
}

/** A stable UUID for a row, so rows keep their id between runs. `space` keeps kinds of row apart. */
export function syntheticId(space: number, n: number): string {
  return `5a7d${space.toString(16).padStart(4, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}
