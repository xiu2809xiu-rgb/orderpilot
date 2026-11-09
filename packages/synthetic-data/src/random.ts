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

  /**
   * A stream of its own for one purpose. It never touches the stream it came
   * from, so data added later cannot move the draws of data that already exists.
   */
  static child(seed: number, label: string): SeededRandom {
    return new SeededRandom(hash32(`${String(seed)}:${label}`));
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

// A 32-bit FNV-1a hash followed by a murmur-style finalizer. FNV alone keeps
// the last characters in the low bits, so keys that differ only in a trailing
// number would give neighbouring values.
function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A number from 0 up to, not including, 1 that depends only on the seed and the
 * keys, never on how many numbers were drawn before. New data uses it so it
 * cannot move the draws the older data relies on.
 */
export function hashUnit(
  seed: number,
  ...keys: readonly (string | number)[]
): number {
  return hash32(`${String(seed)}:${keys.join(":")}`) / 4294967296;
}
