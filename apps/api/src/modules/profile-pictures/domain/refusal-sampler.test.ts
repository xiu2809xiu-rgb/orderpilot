import { describe, expect, it } from "vitest";
import { RefusalSampler } from "./refusal-sampler.js";

const START = new Date("2026-11-24T12:00:00.000Z").getTime();
const at = (seconds: number): Date => new Date(START + seconds * 1000);

describe("RefusalSampler", () => {
  it("lets one refusal per key through a minute", () => {
    const sampler = new RefusalSampler();
    expect(sampler.shouldWrite("user-1:damaged", at(0))).toBe(true);
    expect(sampler.shouldWrite("user-1:damaged", at(1))).toBe(false);
    expect(sampler.shouldWrite("user-1:damaged", at(59))).toBe(false);
    expect(sampler.shouldWrite("user-1:damaged", at(60))).toBe(true);
  });

  it("counts a refused attempt from the last one written, not the last one seen", () => {
    const sampler = new RefusalSampler();
    expect(sampler.shouldWrite("k", at(0))).toBe(true);
    expect(sampler.shouldWrite("k", at(50))).toBe(false);
    // 60 s after the write, not after the refused attempt at 50 s.
    expect(sampler.shouldWrite("k", at(61))).toBe(true);
  });

  it("lets a different key through", () => {
    const sampler = new RefusalSampler();
    expect(sampler.shouldWrite("user-1:damaged", at(0))).toBe(true);
    expect(sampler.shouldWrite("user-1:empty", at(0))).toBe(true);
    expect(sampler.shouldWrite("user-2:damaged", at(0))).toBe(true);
  });

  it("stays bounded when a flood of keys arrives", () => {
    const sampler = new RefusalSampler();
    for (let i = 0; i < 10_500; i += 1) {
      sampler.shouldWrite(`user-${String(i)}:damaged`, at(0));
    }
    expect(sampler.size()).toBeLessThanOrEqual(10_000);
  });

  it("forgets keys older than a minute", () => {
    const sampler = new RefusalSampler();
    sampler.shouldWrite("old", at(0));
    sampler.shouldWrite("newer", at(100));
    expect(sampler.size()).toBe(1);
  });
});
