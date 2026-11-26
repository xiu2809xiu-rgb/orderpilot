import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import { codeFieldMotion } from "./codeFieldMotion";

const here = import.meta.dirname;
const css = readFileSync(path.join(here, "codeField.css"), "utf8");
const tokens = readFileSync(
  path.join(here, "../../../styles/tokens.css"),
  "utf8",
);

/** The value of a custom property in the first block that declares it. */
function declared(source: string, name: string): string {
  const marker = `--${name}:`;
  const at = source.indexOf(marker);
  expect(at, marker).toBeGreaterThanOrEqual(0);
  return source.slice(at + marker.length, source.indexOf(";", at)).trim();
}

const ms = (value: string) => Number.parseFloat(value);

describe("the field's motion", () => {
  it("equals the tokens it names", () => {
    expect(codeFieldMotion.revealMs).toBe(ms(declared(tokens, "motion-slow")));
    expect(codeFieldMotion.successMs).toBe(ms(declared(tokens, "motion-slow")));
    expect(codeFieldMotion.collapseMs).toBe(
      ms(declared(tokens, "motion-base")),
    );
    expect(codeFieldMotion.digitRiseMs).toBe(
      ms(declared(tokens, "motion-fast")),
    );
    expect(codeFieldMotion.ringSpring.stiffness).toBe(
      ms(declared(tokens, "spring-stiffness")),
    );
    expect(codeFieldMotion.ringSpring.damping).toBe(
      ms(declared(tokens, "spring-damping")),
    );
  });

  it("writes the two durations the sheet owns as the numbers it holds", () => {
    expect(declared(css, "cf-shake")).toBe(
      `${String(codeFieldMotion.shakeMs)}ms`,
    );
    expect(declared(css, "cf-spin")).toBe(
      `${String(codeFieldMotion.spinnerMs)}ms`,
    );
  });

  it("uses the tokens for the unfold, the collapse, the rise and the green fill", () => {
    expect(css).toMatch(/animation: cf-unfold var\(--motion-slow\)/);
    expect(css).toMatch(/animation: cf-cells-in var\(--motion-slow\)/);
    expect(css).toMatch(/animation: cf-rise var\(--motion-fast\)/);
    expect(css).toMatch(/inline-size var\(--motion-base\)/);
    expect(css).toMatch(/animation: cf-pop var\(--motion-slow\)/);
  });

  it("keeps every transition and every finite animation inside 150 to 250 ms", () => {
    const named: Record<string, number> = {
      "--motion-fast": ms(declared(tokens, "motion-fast")),
      "--motion-base": ms(declared(tokens, "motion-base")),
      "--motion-slow": ms(declared(tokens, "motion-slow")),
      "--cf-shake": ms(declared(css, "cf-shake")),
    };
    const seconds = (token: string): number | undefined => {
      const literal = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(token);
      if (literal) {
        return Number(literal[1]) * (literal[2] === "s" ? 1000 : 1);
      }
      const variable = /^var\((--[\w-]+)\)$/.exec(token);
      return variable ? named[must(variable[1])] : undefined;
    };
    const failures: string[] = [];
    let checked = 0;
    for (const match of css.matchAll(/\b(transition|animation):\s*([^;]+);/g)) {
      // One entry per comma that is not inside a bracket, so steps(1, end) stays whole.
      const entries: string[] = [];
      let depth = 0;
      let start = 0;
      const body = must(match[2]);
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] === "(") depth += 1;
        if (body[i] === ")") depth -= 1;
        if (body[i] === "," && depth === 0) {
          entries.push(body.slice(start, i));
          start = i + 1;
        }
      }
      entries.push(body.slice(start));
      for (const entry of entries) {
        // A loop (the spinner, the caret) is not a transition.
        if (/\binfinite\b/.test(entry)) continue;
        const times = entry
          .trim()
          .split(/\s+/)
          .map(seconds)
          .filter((value): value is number => value !== undefined);
        const [duration, delay = 0] = times;
        if (duration === undefined) {
          failures.push(`no duration in "${entry.trim()}"`);
          continue;
        }
        checked += 1;
        // A zero duration is a switch of visibility, not a movement.
        if (duration === 0) continue;
        if (duration < 150 || duration + delay > 250) {
          failures.push(
            `${entry.trim()}: ${String(duration)} + ${String(delay)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(15);
  });

  it("gives the holds and the pill floor as readable numbers a parent can import", () => {
    expect(codeFieldMotion.verifyingMinMs).toBe(500);
    expect(codeFieldMotion.errorHoldMs).toBe(900);
    expect(codeFieldMotion.successHoldMs).toBe(700);
  });

  it("puts every moving rule under prefers-reduced-motion: no-preference", () => {
    const calm = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(calm).toBeGreaterThan(0);
    const before = css.slice(0, calm);
    const keyframes = css.indexOf("@keyframes");
    // No animation property outside the guarded block, so a still page is the default.
    expect(before).not.toMatch(/\banimation:/);
    expect(keyframes).toBeGreaterThan(calm);
  });
});
