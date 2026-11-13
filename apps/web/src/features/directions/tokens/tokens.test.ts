import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import {
  contrast,
  flatten,
  groundAt,
  parseBlooms,
  parseColor,
  surface,
  worstGround,
  type Rgba,
  type Tokens,
} from "./contrast";

const dir = import.meta.dirname;
const read = (file: string) => readFileSync(path.join(dir, file), "utf8");

const DIRECTIONS = ["ink", "paper", "spectra"] as const;
type Direction = (typeof DIRECTIONS)[number];
const SCHEMES = ["light", "dark"] as const;

/** The custom properties declared in one selector's block. */
function block(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("\n}", start));
  const out: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
  }
  return out;
}

function tokensOf(direction: Direction, scheme: (typeof SCHEMES)[number]) {
  const css = read(`${direction}.css`);
  const light = block(css, `:root[data-direction="${direction}"]`);
  if (scheme === "light") return light;
  return {
    ...light,
    ...block(css, `:root[data-direction="${direction}"].dark`),
  };
}

const SOLID = [
  "background",
  "card",
  "popover",
  "muted",
  "secondary",
  "sidebar",
];
const STATUS = ["success", "warning", "destructive", "info"] as const;

/** Every text colour with every surface it is drawn on. Text needs 4.5:1. */
function textPairs(direction: Direction): [string, string[]][] {
  const pairs: [string, string[]][] = [];
  const glass = direction === "spectra";
  // On the mesh itself only the main text colour is promised; the quieter
  // ones sit on a panel.
  const quiet = glass
    ? ["card", "panel", "panel-strong", "popover", "muted", "secondary"]
    : [...SOLID, ...(direction === "paper" ? ["canvas"] : [])];
  const main = glass ? ["background", ...quiet] : quiet;
  for (const s of main) pairs.push(["foreground", [s]]);
  for (const s of quiet) pairs.push(["muted-foreground", [s]]);
  const faintOn = glass
    ? ["card", "panel-strong", "popover", "secondary"]
    : quiet.filter((s) => s !== "sidebar");
  for (const s of faintOn) pairs.push(["faint-foreground", [s]]);
  pairs.push(["primary-foreground", ["primary"]]);
  pairs.push(["destructive-foreground", ["destructive"]]);
  pairs.push(["accent-foreground", ["accent", "card"]]);
  if (!glass) pairs.push(["accent-foreground", ["accent", "background"]]);
  pairs.push(["sidebar-foreground", [glass ? "panel" : "sidebar"]]);
  pairs.push([
    "sidebar-accent-foreground",
    ["sidebar-accent", glass ? "panel" : "sidebar"],
  ]);
  for (const status of STATUS) {
    pairs.push([status, [`${status}-surface`]]);
    pairs.push([status, ["card"]]);
    if (!glass) pairs.push([status, ["background"]]);
  }
  return pairs;
}

describe.each(DIRECTIONS)("%s", (direction) => {
  describe.each(SCHEMES)("%s scheme", (scheme) => {
    const t = tokensOf(direction, scheme);
    const colour = (name: string): Rgba => parseColor(must(t[name]));

    it("keeps every text colour at 4.5:1 on every surface it sits on", () => {
      const failures: string[] = [];
      for (const [text, chain] of textPairs(direction)) {
        const under = surface(t, chain);
        const ratio = contrast(flatten(colour(text), under), under);
        if (ratio < 4.5) {
          failures.push(
            `${text} on ${chain.join(" over ")}: ${ratio.toFixed(2)}`,
          );
        }
      }
      expect(failures).toEqual([]);
    });

    it("keeps the focus ring at 3:1 on the page and on a card", () => {
      for (const s of ["background", "card"] as const) {
        expect(
          contrast(colour("ring"), surface(t, [s])),
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it("keeps the motion between 150 and 250 ms", () => {
      for (const name of ["motion-fast", "motion-base", "motion-slow"]) {
        const ms = Number.parseFloat(must(t[name]));
        expect(ms, name).toBeGreaterThanOrEqual(150);
        expect(ms, name).toBeLessThanOrEqual(250);
      }
    });
  });

  it("defines the same names as the other directions, in both schemes", () => {
    // Paper alone has a canvas: the margin colour its sheet sits on.
    const names = (d: Direction) =>
      Object.keys(tokensOf(d, "light"))
        .filter((n) => n !== "canvas")
        .sort();
    expect(names(direction)).toEqual(names("ink"));
    expect(Object.keys(tokensOf(direction, "dark")).sort()).toEqual(
      Object.keys(tokensOf(direction, "light")).sort(),
    );
  });

  it("names its page change for the content region", () => {
    const css = read(`${direction}.css`);
    expect(css).toContain(`::view-transition-new(.dx-${direction}-page)`);
    expect(css).toContain(`::view-transition-old(.dx-${direction}-page)`);
  });
});

describe("the brief's values", () => {
  it("holds Ink's hero scheme, light scheme and shape", () => {
    const dark = tokensOf("ink", "dark");
    expect(dark.background).toBe("#0b0c0a");
    expect(dark.card).toBe("#121411");
    expect(dark.popover).toBe("#191b17");
    expect(dark.border).toBe("#262a23");
    expect(dark["border-strong"]).toBe("#3a4035");
    expect(dark.foreground).toBe("#edefe8");
    expect(dark["muted-foreground"]).toBe("#a7ad9e");
    expect(dark["faint-foreground"]).toBe("#7f8676");
    expect(dark.primary).toBe("#c6ff4a");
    expect(dark["primary-foreground"]).toBe("#0b0c0a");
    const light = tokensOf("ink", "light");
    expect(light.background).toBe("#f3f4ef");
    expect(light["accent-foreground"]).toBe("#3d5f00");
    expect(light.accent).toBe("#eaf7c8");
    expect(light["radius-control"]).toBe("3px");
    expect(light["radius-card"]).toBe("4px");
    expect(light["motion-base"]).toBe("160ms");
    expect(light["shadow-card"]).toBe("none");
  });

  it("holds Paper's hero scheme, dark scheme and shape", () => {
    const light = tokensOf("paper", "light");
    expect(light.background).toBe("#ffffff");
    expect(light.canvas).toBe("#f7f7f8");
    expect(light.border).toBe("#e3e3e6");
    expect(light["muted-foreground"]).toBe("#55555e");
    expect(light.primary).toBe("#002fa7");
    expect(light.accent).toBe("#e9eefb");
    expect(light["radius-control"]).toBe("2px");
    expect(light["motion-base"]).toBe("200ms");
    expect(light["shadow-card"]).toBe("none");
    const dark = tokensOf("paper", "dark");
    expect(dark.background).toBe("#0d0d0f");
    expect(dark.canvas).toBe("#131316");
    expect(dark.primary).toBe("#2f4fd0");
    expect(dark["accent-foreground"]).toBe("#8fa8ff");
  });

  it("holds Spectra's hero scheme, glass and shape", () => {
    const dark = tokensOf("spectra", "dark");
    expect(dark.background).toBe("#06162b");
    expect(dark.panel).toBe("rgb(10 24 40 / 0.72)");
    expect(dark["panel-filter"]).toBe("blur(18px) saturate(140%)");
    expect(dark.foreground).toBe("#f1fbfb");
    expect(dark["muted-foreground"]).toBe("#b3ccd1");
    expect(dark["faint-foreground"]).toBe("#8faab2");
    expect(dark.primary).toBe("#2ee6d6");
    expect(dark["primary-foreground"]).toBe("#04121c");
    expect(dark.glow).toBe("0 0 24px rgb(46 230 214 / 0.35)");
    // Indigo stays at 15% or less of the mesh.
    expect(dark["ground-image"]).toContain("rgb(91 108 255 / 0.15)");
    const light = tokensOf("spectra", "light");
    expect(light.background).toBe("#f2f9fa");
    expect(light.panel).toBe("rgb(255 255 255 / 0.82)");
    expect(light.primary).toBe("#0e7c86");
    expect(light["accent-foreground"]).toBe("#0b7480");
    expect(light.glow).toBe("0 8px 28px rgb(14 124 134 / 0.18)");
    expect(light["radius-control"]).toBe("12px");
    expect(light["radius-card"]).toBe("16px");
    expect(light["motion-base"]).toBe("220ms");
    expect(light["spring-stiffness"]).toBe("260");
    expect(light["spring-damping"]).toBe("28");
  });

  it("keeps Spectra's work panels opaque enough over the brightest mesh", () => {
    const t = tokensOf("spectra", "dark");
    const strong = flatten(parseColor(must(t["panel-strong"])), worstGround(t));
    for (const text of ["foreground", "muted-foreground", "faint-foreground"]) {
      expect(
        contrast(parseColor(must(t[text])), strong),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("the shared base", () => {
  const base = read("base.css");

  it("has exactly seven type sizes: 12, 13, 14, 16, 20, 28 and 44 px", () => {
    const sizes = [...base.matchAll(/--type-(\d+):\s*([\d.]+)rem;/g)].map(
      (m) => [Number(m[1]), Number(m[2]) * 16] as const,
    );
    expect(sizes.map(([name]) => name)).toEqual([12, 13, 14, 16, 20, 28, 44]);
    for (const [name, px] of sizes) expect(px).toBe(name);
  });

  it("keeps the preview's own bar readable in both schemes", () => {
    const light = block(base, ":root");
    const dark = { ...light, ...block(base, ":root.dark") };
    for (const t of [light, dark]) {
      const bg = parseColor(must(t["pv-bg"]));
      const fg = parseColor(must(t["pv-fg"]));
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(parseColor(must(t["pv-muted"])), bg),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(fg, parseColor(must(t["pv-active"]))),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("switches page-change animation off under reduced motion", () => {
    expect(base).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*view-transition-new/,
    );
  });
});

describe("what makes each direction structurally its own", () => {
  const STRUCTURE = [
    "dx-card-bg",
    "dx-card-work-bg",
    "dx-card-sheen",
    "dx-card-border",
    "dx-card-shadow",
    "dx-card-filter",
    "dx-card-pad",
    "dx-head-rule",
    "dx-head-pb",
    "dx-title-size",
    "dx-title-weight",
    "dx-title-tracking",
    "dx-title-from",
    "dx-title-to",
    "dx-panel-edge",
    "dx-entry-pad",
    "dx-entry-radius",
    "dx-group-font",
    "dx-group-size",
    "dx-group-weight",
    "dx-group-tracking",
    "dx-group-colour",
    "dx-hover-bg",
    "dx-current-bg",
    "dx-current-image",
    "dx-current-fg",
    "dx-current-shadow",
    "dx-bar-btn-border",
    "dx-bar-btn-bg",
    "dx-bar-btn-hover",
    "dx-bar-btn-radius",
  ];

  it.each(DIRECTIONS)("%s defines every structure variable", (direction) => {
    const light = tokensOf(direction, "light");
    expect(STRUCTURE.filter((name) => light[name] === undefined)).toEqual([]);
  });

  it("makes Ink flat: no shadow, no blur, a 4 px corner, a rule under a title", () => {
    const t = tokensOf("ink", "dark");
    expect(t["dx-card-shadow"]).toBe("none");
    expect(t["dx-card-filter"]).toBe("none");
    expect(t["radius-card"]).toBe("4px");
    expect(t["dx-head-rule"]).toContain("1px solid");
    expect(t["dx-title-size"]).toBe("var(--type-28)");
    expect(t["dx-group-font"]).toContain("Geist Mono");
    expect(t["dx-group-size"]).toBe("var(--type-12)");
    expect(t["dx-current-shadow"]).toContain("inset 2px 0 0");
    expect(t["dx-current-image"]).toBe("none");
  });

  it("makes Paper a ruled sheet: no card fill, 2 px corners, a 44 px title", () => {
    const t = tokensOf("paper", "light");
    expect(t["dx-card-bg"]).toBe("transparent");
    expect(t["dx-card-shadow"]).toBe("none");
    expect(Number.parseFloat(must(t["radius-card"]))).toBeLessThanOrEqual(2);
    expect(t["dx-title-size"]).toBe("var(--type-44)");
    expect(t["dx-title-weight"]).toBe("500");
    expect(t["dx-current-bg"]).toBe("transparent");
    expect(t["dx-current-shadow"]).toContain("inset 2px 0 0");
  });

  it("makes Spectra glass: blur, a 16 px corner, a pill for the current entry", () => {
    for (const scheme of SCHEMES) {
      const t = tokensOf("spectra", scheme);
      expect(t["dx-card-filter"]).toContain("blur(");
      expect(t["radius-card"]).toBe("16px");
      expect(t["dx-entry-radius"]).toBe("999px");
      expect(t["dx-current-shadow"]).toContain("0 ");
      expect(parseColor(must(t.card)).a).toBeLessThan(1);
    }
  });

  it("keeps Spectra's gradient title at 3:1 against the ground along its whole length", () => {
    for (const scheme of SCHEMES) {
      const t = tokensOf("spectra", scheme);
      const from = parseColor(must(t["dx-title-from"]));
      const to = parseColor(must(t["dx-title-to"]));
      // A title sits in the top band of the content, to the right of the panel.
      const ground = worstGround(t, { x0: 0.18, x1: 0.9, y0: 0.08, y1: 0.3 });
      for (let i = 0; i <= 10; i += 1) {
        const k = i / 10;
        const here = {
          r: from.r + (to.r - from.r) * k,
          g: from.g + (to.g - from.g) * k,
          b: from.b + (to.b - from.b) * k,
          a: 1,
        };
        expect(
          contrast(here, ground),
          `${scheme} at ${String(i * 10)}%`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("gives Spectra several blooms that actually change the ground", () => {
    for (const scheme of SCHEMES) {
      const t = tokensOf("spectra", scheme);
      const blooms = parseBlooms(must(t["ground-image"]));
      expect(blooms.length).toBeGreaterThanOrEqual(4);
      // At the centre of the strongest bloom the ground has moved clearly away
      // from the plain background colour.
      const background = parseColor(must(t.background));
      const centre = blooms.reduce((a, b) => (b.colour.a > a.colour.a ? b : a));
      const there = groundAt(t, blooms, centre.cx, centre.cy);
      expect(contrast(there, background)).toBeGreaterThan(1.15);
    }
  });

  it("measures the worst ground by sampling, not by stacking every layer", () => {
    const t = {
      background: "#000000",
      "ground-image":
        "radial-gradient(40% 40% at 0% 0%, #ffffff, transparent 100%), radial-gradient(40% 40% at 100% 100%, #ffffff, transparent 100%)",
    };
    const worst = worstGround(t);
    // Two white blooms in opposite corners never overlap, so the brightest
    // point is one bloom at full strength, not two stacked.
    expect(worst.r).toBeGreaterThan(250);
    expect(worstGround({ ...t, "ground-image": "none" }).r).toBe(0);
    // A bloom only in the top left corner is still found, whichever end of the
    // window the sampler finishes at.
    const corner = {
      background: "#000000",
      "ground-image":
        "radial-gradient(30% 30% at 0% 0%, #ffffff, transparent 100%)",
    };
    expect(worstGround(corner).r).toBeGreaterThan(250);
    // On a light ground the worst point is the darkest one.
    const light = {
      background: "#ffffff",
      "ground-image":
        "radial-gradient(30% 30% at 0% 0%, #000000, transparent 100%)",
    };
    expect(worstGround(light).r).toBeLessThan(5);
  });
});
