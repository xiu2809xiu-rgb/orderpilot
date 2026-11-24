const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

/**
 * Lets one refusal per key through a minute. A person sending 200 junk files
 * would otherwise write 200 rows into the tamper-evident chain, under the
 * chain lock; one row per person and reason a minute says what happened.
 * The map is bounded, so a flood of keys cannot grow it.
 */
export class RefusalSampler {
  /** In order of the last write, oldest first: a Map keeps insertion order. */
  private readonly written = new Map<string, number>();

  shouldWrite(key: string, now: Date): boolean {
    const at = now.getTime();
    const last = this.written.get(key);
    if (last !== undefined && at - last < WINDOW_MS) return false;
    // Delete first, so the key moves to the end of the order.
    this.written.delete(key);
    this.written.set(key, at);
    this.trim(at);
    return true;
  }

  size(): number {
    return this.written.size;
  }

  private trim(at: number): void {
    while (this.written.size > MAX_KEYS) {
      const oldest = this.written.keys().next();
      if (oldest.done === true) return;
      this.written.delete(oldest.value);
    }
    // An expired key is no use to keep: drop those at the front.
    for (const [key, time] of this.written) {
      if (at - time < WINDOW_MS) break;
      this.written.delete(key);
    }
  }
}
