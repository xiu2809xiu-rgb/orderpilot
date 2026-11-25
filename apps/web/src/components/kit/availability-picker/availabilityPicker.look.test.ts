import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";

const here = import.meta.dirname;
const read = (file: string) => readFileSync(path.join(here, file), "utf8");
const picker = read("availabilityPicker.css");
const dot = read("availabilityDot.css");
const sheets = {
  "availabilityPicker.css": picker,
  "availabilityDot.css": dot,
};
const pickerSource = read("AvailabilityPicker.tsx");

/** The text of one at-rule block, braces matched. */
function atRule(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, header).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let at = source.indexOf("{", start); at < source.length; at += 1) {
    if (source[at] === "{") depth += 1;
    if (source[at] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, at + 1);
  }
  throw new Error(`${header} is not closed`);
}

describe.each(Object.entries(sheets))("%s", (_name, css) => {
  it("holds no hex colour: every colour is a token or a system colour", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("has a forced-colors block that sets system colours", () => {
    const block = atRule(css, "@media (forced-colors: active)");
    expect(block).toMatch(/CanvasText|ButtonText/);
    expect(block).toMatch(/Highlight|ButtonFace|Canvas/);
  });

  it("blurs no more than 12 px", () => {
    for (const match of css.matchAll(/blur\((\d+)px\)/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(12);
    }
  });
});

describe("the pill's sheet", () => {
  it("says animation: none under prefers-reduced-motion: reduce", () => {
    const block = atRule(picker, "@media (prefers-reduced-motion: reduce)");
    expect(block).toMatch(/animation:\s*none/);
    expect(block).toContain(".ap-pill");
  });

  it("puts every moving rule under prefers-reduced-motion: no-preference", () => {
    const calm = atRule(
      picker,
      "@media (prefers-reduced-motion: no-preference)",
    );
    const reduce = atRule(picker, "@media (prefers-reduced-motion: reduce)");
    const outside = picker.replace(calm, "").replace(reduce, "");
    expect(outside).not.toMatch(/\banimation:/);
  });

  it("has a coarse-pointer block with 44 px boxes and the words under the orbs", () => {
    const block = atRule(picker, "@media (pointer: coarse), (hover: none)");
    // Every box an item can have on a finger is 44 px or more: the orb is 44
    // and the item is the orb with its words.
    const item = must(/\.ap-item\s*{([^}]*)}/.exec(block))[1] ?? "";
    for (const size of item.matchAll(/(?:inline|block)-size: (\d+)px/g)) {
      expect(Number(size[1])).toBeGreaterThanOrEqual(44);
    }
    expect(item).toContain("80px");
    expect(block).toContain("min(266px, calc(100vw - 16px))");
    expect(block).toMatch(/\.ap-chip,\s*\.ap-measure\s*{\s*display: none/);
  });

  it("animates only scale and opacity in the pill's keyframes", () => {
    for (const name of [
      "ap-grow",
      "ap-fade",
      "ap-fold",
      "ap-orb-in",
      "ap-text-in",
      "ap-text-out",
    ]) {
      const block = atRule(picker, `@keyframes ${name}`);
      const properties = [...block.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      const allowed = new Set(["scale", "opacity"]);
      for (const property of properties) {
        expect(
          allowed.has(must(property)),
          `${name} animates ${String(property)}`,
        ).toBe(true);
      }
    }
  });

  it("has an exit animation for the closed state, so Radix keeps it mounted until it ends", () => {
    expect(picker).toMatch(
      /\.ap-pill\[data-state="closed"\]\s*{\s*animation: ap-fold/,
    );
  });

  it("has the glass on from the first frame and fades the box in on its own quick animation, so the page's words never show through a growing box", () => {
    expect(picker).toMatch(/\.ap-pill\s*{[^}]*backdrop-filter: blur\(12px\)/);
    expect(picker).not.toMatch(
      /\.ap-pill\[data-settled\]\s*{\s*backdrop-filter/,
    );
    // The growth keyframes move the size only: the opacity has its own.
    expect(atRule(picker, "@keyframes ap-grow")).not.toContain("opacity");
    expect(picker).toMatch(/ap-fade var\(--motion-fast\)/);
  });

  it("holds each new caption word back until the caption's box has caught up with it", () => {
    expect(picker).toMatch(
      /animation: ap-text-in var\(--motion-fast\) var\(--ease-out\) 60ms both/,
    );
  });

  it("fades the leaving caption word out where it stands, over the same time the new one takes", () => {
    expect(picker).toMatch(
      /\.ap-chip-text\[data-leaving\]\s*{\s*animation: ap-text-out var\(--motion-fast\) var\(--ease-out\) both/,
    );
    // Both words share the capsule's one cell, so each is centred in it.
    expect(picker).toMatch(/\.ap-chip-text\s*{\s*grid-area: 1 \/ 1/);
  });

  it("starts the growth at the transform origin Radix gives the pill", () => {
    expect(picker).toContain(
      "transform-origin: var(--radix-dropdown-menu-content-transform-origin)",
    );
  });

  it("marks the checked item inside the orb and the focus ring outside it, so they are never one circle", () => {
    expect(picker).toMatch(
      /\.ap-item\[aria-checked="true"\] \.ap-orb\s*{\s*box-shadow: inset 0 0 0 2px var\(--foreground\)/,
    );
    expect(picker).toMatch(
      /\.ap-item:focus-visible\s*{\s*outline: 2px solid var\(--ring\);\s*outline-offset: 4px/,
    );
  });
});

describe("the dot's sheet", () => {
  it("makes a 44 px box on a coarse pointer", () => {
    const block = atRule(dot, "@media (pointer: coarse)");
    expect(block).toMatch(
      /\.ap-trigger\s*{\s*inline-size: 44px;\s*block-size: 44px;/,
    );
    expect(block).toMatch(
      /\.ap-trigger\[data-skin="ring"\]\s*{\s*inline-size: 44px;\s*block-size: 44px;/,
    );
  });

  it("sets no position on the dot or the button, so a caller's absolute utility is not beaten by this unlayered sheet", () => {
    for (const rule of [/\.ap-dot\s*{([^}]*)}/, /\.ap-trigger\s*{([^}]*)}/]) {
      expect(must(rule.exec(dot))[1]).not.toMatch(/\bposition:/);
    }
  });

  it("paints the ring under the dot: the ring is positioned and the dot is not, so it needs a stacking context of the face and a negative z-index", () => {
    expect(dot).toMatch(/\.ap-face\s*{[^}]*isolation: isolate/s);
    expect(dot).toMatch(/\.ap-ring\s*{[^}]*z-index: -1/s);
  });

  it("takes the mark's colour from its dot, whatever a menu item says about icons, and forced colours still reach it through the dot", () => {
    // A menu item paints every icon with no text colour class in its muted
    // colour, which would draw the mark in the row's text colour on the dot.
    expect(must(/\.ap-mark\s*{([^}]*)}/.exec(dot))[1]).toMatch(
      /color: inherit;/,
    );
    const forced = atRule(dot, "@media (forced-colors: active)");
    expect(must(/\.ap-dot\s*{([^}]*)}/.exec(forced))[1]).toContain(
      "color: ButtonText",
    );
  });

  it("keeps the 24 px of WCAG 2.5.8 on a fine pointer", () => {
    expect(dot).toMatch(
      /\.ap-trigger\s*{[^}]*inline-size: 24px;[^}]*block-size: 24px/s,
    );
  });

  it("gates its sheen and its pulse on no-preference", () => {
    const calm = atRule(dot, "@media (prefers-reduced-motion: no-preference)");
    expect(calm).toContain("ap-sheen");
    expect(calm).toContain("ap-pulse");
  });
});

describe("the pill's content", () => {
  it("is built on Radix's content directly, so none of the wrapper's entrance classes can reach it", () => {
    expect(pickerSource).not.toContain("@/components/ui/dropdown-menu");
    const classes = pickerSource.match(/className="([^"]*)"/g)?.join(" ") ?? "";
    expect(classes).not.toMatch(/zoom-in-95|slide-in-from-|fade-in-0/);
  });
});
