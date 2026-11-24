import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import {
  GROW_EASING,
  GROW_MS,
  chipPlace,
  pickerMotion,
  pillGeometry,
  settleSeconds,
  springEasing,
  springStep,
} from "./pickerMotion";

const here = import.meta.dirname;
const tokens = readFileSync(
  path.join(here, "../../../styles/tokens.css"),
  "utf8",
);
const pickerCss = readFileSync(
  path.join(here, "availabilityPicker.css"),
  "utf8",
);
const dotCss = readFileSync(path.join(here, "availabilityDot.css"), "utf8");

/** The value of a custom property in the first block that declares it. */
function declared(name: string): number {
  const marker = `--${name}:`;
  const at = tokens.indexOf(marker);
  expect(at, marker).toBeGreaterThanOrEqual(0);
  return Number.parseFloat(
    tokens.slice(at + marker.length, tokens.indexOf(";", at)).trim(),
  );
}

describe("the picker's motion", () => {
  it("equals the tokens it names", () => {
    expect(pickerMotion.spring.stiffness).toBe(declared("spring-stiffness"));
    expect(pickerMotion.spring.damping).toBe(declared("spring-damping"));
    expect(pickerMotion.foldMs).toBe(declared("motion-fast"));
    expect(pickerMotion.orbMs).toBe(declared("motion-fast"));
    expect(pickerMotion.chipTextMs).toBe(declared("motion-fast"));
    expect(pickerMotion.pickMs).toBe(declared("motion-slow"));
  });

  it("uses the tokens by name in the sheets, and the spring only for the growth", () => {
    expect(pickerCss).toMatch(/animation: ap-fold var\(--motion-fast\)/);
    expect(pickerCss).toMatch(/animation: ap-orb-in var\(--motion-fast\)/);
    expect(pickerCss).toMatch(/animation: ap-text-in var\(--motion-fast\)/);
    expect(pickerCss).toMatch(
      /animation: ap-grow var\(--ap-grow, \d+ms\) var\(--ap-spring/,
    );
    expect(dotCss).toMatch(/animation: ap-sheen var\(--motion-slow\)/);
    expect(dotCss).toMatch(/animation: ap-pulse var\(--motion-slow\)/);
  });

  it("keeps every transition and animation inside 150 to 250 ms, but the one token spring", () => {
    const named: Record<string, number> = {
      "--motion-fast": declared("motion-fast"),
      "--motion-base": declared("motion-base"),
      "--motion-slow": declared("motion-slow"),
    };
    let checked = 0;
    const failures: string[] = [];
    for (const source of [pickerCss, dotCss]) {
      for (const match of source.matchAll(
        /\b(transition|animation):\s*([^;]+);/g,
      )) {
        // The growth is the one spring: spatial movement, as CLAUDE.md allows.
        if (match[2]?.includes("ap-grow")) continue;
        const body = must(match[2]);
        for (const entry of body.split(/,(?![^(]*\))/)) {
          // Reduced motion removes the animation: nothing to time.
          if (entry.trim() === "none") continue;
          const first = /var\((--motion-[a-z]+)\)|(\d+)ms/.exec(entry);
          const duration = first?.[1] ? named[first[1]] : Number(first?.[2]);
          if (first === null || duration === undefined) {
            failures.push(`no duration in "${entry.trim()}"`);
            continue;
          }
          checked += 1;
          if (duration < 150 || duration > 250) {
            failures.push(`${entry.trim()}: ${String(duration)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(6);
  });

  it("keeps the last orb's stagger inside the 250 ms band", () => {
    const last = 2;
    expect(
      pickerMotion.orbMs + last * pickerMotion.orbStaggerMs,
    ).toBeLessThanOrEqual(250);
    expect(pickerCss).toContain("calc(var(--ap-i, 0) * 30ms)");
    expect(pickerMotion.orbStaggerMs).toBe(30);
  });
});

describe("the spring", () => {
  const { stiffness, damping } = pickerMotion.spring;

  it("starts at rest and ends at 1", () => {
    expect(springStep(stiffness, damping, 0)).toBe(0);
    expect(springStep(stiffness, damping, 5)).toBeCloseTo(1, 6);
    expect(GROW_EASING.endsWith(", 1)")).toBe(true);
    expect(GROW_EASING.startsWith("linear(0, ")).toBe(true);
  });

  it("overshoots by 0.41 percent and no more", () => {
    let top = 0;
    for (let t = 0; t < 2; t += 0.001) {
      top = Math.max(top, springStep(stiffness, damping, t));
    }
    expect(top - 1).toBeGreaterThan(0.004);
    expect(top - 1).toBeLessThan(0.0042);
  });

  it("is within 2 percent of 1 at 0.29 s", () => {
    expect(Math.abs(springStep(stiffness, damping, 0.29) - 1)).toBeLessThan(
      0.02,
    );
  });

  it("runs the growth for the time the spring needs to settle", () => {
    expect(settleSeconds(stiffness, damping)).toBeCloseTo(0.31, 2);
    expect(GROW_MS).toBe(310);
  });

  it("writes the spring as a linear() easing of 33 points between 0 and 1.01", () => {
    const body = must(
      /^linear\((.*)\)$/.exec(springEasing(stiffness, damping)),
    )[1];
    const points = must(body).split(", ").map(Number);
    expect(points).toHaveLength(33);
    expect(Math.max(...points)).toBeLessThan(1.01);
    expect(Math.min(...points)).toBeGreaterThanOrEqual(0);
  });
});

describe("the caption's place", () => {
  const { width } = pillGeometry.fine;

  it("is as wide as its word plus 24 px, and at least 72", () => {
    expect(chipPlace(0, 40).w).toBe(72);
    expect(chipPlace(2, 90.2).w).toBe(115);
  });

  it("is centred under its orb and kept inside the pill", () => {
    const first = chipPlace(0, 60);
    expect(first.x).toBe(4);
    const middle = chipPlace(1, 60);
    expect(middle.x + middle.w / 2).toBe(82);
    const last = chipPlace(2, 90);
    expect(last.x + last.w).toBe(width - 4);
  });

  it("still spans the whole orb for the longest word, so it stays under its choice", () => {
    const last = chipPlace(2, 85);
    // The third orb lies from 112 to 156.
    expect(last.x).toBeLessThanOrEqual(112);
    expect(last.x + last.w).toBeGreaterThanOrEqual(156);
  });
});
