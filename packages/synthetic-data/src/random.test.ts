import { describe, expect, it } from "vitest";
import { SeededRandom, hashUnit } from "./random.js";

function draw(random: SeededRandom, count: number): number[] {
  return Array.from({ length: count }, () => random.next());
}

describe("keyed streams", () => {
  it("gives the same numbers for the same seed and label", () => {
    expect(draw(SeededRandom.child(7, "history"), 5)).toEqual(
      draw(SeededRandom.child(7, "history"), 5),
    );
  });

  it("gives other numbers for another label or another seed", () => {
    const base = draw(SeededRandom.child(7, "history"), 5);
    expect(draw(SeededRandom.child(7, "kpis"), 5)).not.toEqual(base);
    expect(draw(SeededRandom.child(8, "history"), 5)).not.toEqual(base);
  });

  it("leaves the stream it was made beside untouched", () => {
    const plain = draw(new SeededRandom(7), 5);
    const beside = new SeededRandom(7);
    SeededRandom.child(7, "history").next();
    expect(draw(beside, 5)).toEqual(plain);
  });
});

describe("hashUnit", () => {
  it("depends only on its seed and keys", () => {
    expect(hashUnit(7, "C-0001", "I-0002")).toBe(
      hashUnit(7, "C-0001", "I-0002"),
    );
    expect(hashUnit(7, "C-0001", "I-0002")).not.toBe(
      hashUnit(7, "C-0001", "I-0003"),
    );
    expect(hashUnit(7, "a", 1)).not.toBe(hashUnit(8, "a", 1));
  });

  it("stays in [0, 1) and spreads over it", () => {
    const values = Array.from({ length: 2000 }, (_, i) => hashUnit(1, "k", i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
