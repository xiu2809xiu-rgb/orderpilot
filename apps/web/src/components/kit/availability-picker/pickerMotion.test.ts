import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import {
  GROW_COARSE,
  GROW_FINE,
  PILL_EDGE_GAP,
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
    expect(pickerMotion.pop.stiffness).toBe(declared("spring-pop-stiffness"));
    expect(pickerMotion.pop.damping).toBe(declared("spring-pop-damping"));
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
      /animation:\s*ap-grow var\(--ap-grow, \d+ms\) var\(--ap-spring[^;]*ap-fade var\(--motion-fast\)/,
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
    expect(GROW_COARSE.easing.endsWith(", 1)")).toBe(true);
    expect(GROW_COARSE.easing.startsWith("linear(0, ")).toBe(true);
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
    expect(GROW_COARSE.ms).toBe(310);
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

/** The highest the spring goes above 1, as a fraction. */
function overshoot(spring: { stiffness: number; damping: number }): number {
  let top = 0;
  for (let t = 0; t < 2; t += 0.001) {
    top = Math.max(top, springStep(spring.stiffness, spring.damping, t));
  }
  return top - 1;
}

/** How far a box that grows from `from` to `size` px passes its size at the spring's peak. */
function passesBy(
  spring: { stiffness: number; damping: number },
  from: number,
  size: number,
): number {
  return overshoot(spring) * (size - from);
}

describe("the pop spring, which grows the pill on a fine pointer", () => {
  const { pop, spring } = pickerMotion;
  const { fine, coarse, trigger } = pillGeometry;

  it("overshoots between 4 and 5 percent, which the calm spring does not", () => {
    expect(overshoot(pop)).toBeGreaterThan(0.04);
    expect(overshoot(pop)).toBeLessThan(0.05);
    expect(overshoot(spring)).toBeLessThan(0.005);
  });

  it("peaks at about 220 ms and is inside half a percent by 350 ms", () => {
    let top = 0;
    let at = 0;
    for (let t = 0; t < 1; t += 0.001) {
      const value = springStep(pop.stiffness, pop.damping, t);
      if (value > top) {
        top = value;
        at = t;
      }
    }
    expect(at).toBeGreaterThan(0.21);
    expect(at).toBeLessThan(0.23);
    expect(settleSeconds(pop.stiffness, pop.damping)).toBeCloseTo(0.35, 2);
    expect(GROW_FINE.ms).toBe(350);
  });

  it("writes its easing so that it ends at exactly 1 and holds a sample above 1", () => {
    const body = must(/^linear\((.*)\)$/.exec(GROW_FINE.easing))[1];
    const points = must(body).split(", ").map(Number);
    expect(points.at(-1)).toBe(1);
    expect(Math.max(...points)).toBeGreaterThan(1);
    expect(Math.max(...points)).toBeLessThan(1.05);
  });

  it("is the growth of the fine pill, and the touch pill keeps the calm spring", () => {
    expect(GROW_FINE.easing).toBe(springEasing(pop.stiffness, pop.damping));
    expect(GROW_COARSE.easing).toBe(
      springEasing(spring.stiffness, spring.damping),
    );
    expect(GROW_COARSE.easing).not.toBe(GROW_FINE.easing);
  });

  it("keeps the fine pill's peak inside the 8 px the menu keeps from the screen's edge", () => {
    expect(PILL_EDGE_GAP).toBe(8);
    for (const from of [trigger.dot, trigger.ring]) {
      expect(passesBy(pop, from, fine.width)).toBeLessThan(PILL_EDGE_GAP);
    }
  });

  it("would carry the touch pill past that edge, which is why it keeps the calm spring", () => {
    expect(passesBy(pop, trigger.touch, coarse.width)).toBeGreaterThan(
      PILL_EDGE_GAP,
    );
    expect(passesBy(spring, trigger.touch, coarse.width)).toBeLessThan(
      PILL_EDGE_GAP,
    );
  });

  it("is told to Radix as the same gap that the touch pill's width leaves on each side", () => {
    expect(pickerCss).toContain(`calc(100vw - ${String(2 * PILL_EDGE_GAP)}px)`);
  });
});

describe("the pill's boxes", () => {
  const { orb, pad, gap, border, fine, coarse } = pillGeometry;

  it("hold their content and the border, so the orbs sit in the middle", () => {
    // Three 44 px orbs, two gaps and the padding on each side.
    expect(fine.width - 2 * border).toBe(3 * orb + 2 * gap + 2 * pad);
    // Three 80 px choices, two 4 px gaps and the padding.
    expect(coarse.width - 2 * border).toBe(3 * 80 + 2 * 4 + 2 * pad);
    expect(coarse.height - 2 * border).toBe(pad + 80 + pad);
    expect(fine.height - 2 * border).toBe(
      pad + orb + 6 + pillGeometry.chip.height + pad,
    );
  });

  it("are the sizes the sheet draws, on a fine pointer and on a finger", () => {
    const fineBox = must(/^\.ap-pill\s*{([^}]*)}/m.exec(pickerCss))[1] ?? "";
    expect(fineBox).toContain(`inline-size: ${String(fine.width)}px`);
    expect(fineBox).toContain(`block-size: ${String(fine.height)}px`);
    expect(fineBox).toContain("border: 1px solid");
    const touch = must(
      /@media \(pointer: coarse\)[^{]*{([\s\S]*)/.exec(pickerCss),
    )[1];
    expect(touch).toContain(
      `inline-size: min(${String(coarse.width)}px, calc(100vw - 16px))`,
    );
    expect(touch).toContain(`block-size: ${String(coarse.height)}px`);
  });

  it("grow from the trigger's box by a ratio of the border box", () => {
    expect(pickerCss).toContain(
      `--ap-from-x: calc(24 / ${String(fine.width)})`,
    );
    expect(pickerCss).toContain(
      `--ap-from-y: calc(24 / ${String(fine.height)})`,
    );
    expect(pickerCss).toContain(
      `--ap-from-x: calc(32 / ${String(fine.width)})`,
    );
    expect(pickerCss).toContain(
      `--ap-from-x: calc(44 / ${String(coarse.width)})`,
    );
    expect(pickerCss).toContain(
      `--ap-from-y: calc(44 / ${String(coarse.height)})`,
    );
  });
});

describe("the caption's place", () => {
  // The caption is placed inside the border.
  const width = pillGeometry.fine.width - 2 * pillGeometry.border;

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
