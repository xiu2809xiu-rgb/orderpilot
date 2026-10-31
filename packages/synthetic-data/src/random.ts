/**
 * A small seeded random generator (mulberry32). The same seed always gives the
 * same numbers, on every machine, so the demo data never changes by accident.
 * Not for anything secret.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A number from 0 up to, not including, 1. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A whole number from min to max, both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new RangeError("Cannot pick from nothing");
    return item;
  }

  /** A decimal string with two places, such as "12.50", from min to max. */
  money(min: number, max: number): string {
    return (this.int(min * 100, max * 100) / 100).toFixed(2);
  }
}
