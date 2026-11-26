import { readFileSync, readdirSync, statSync } from "node:fs";
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
const src = path.join(dir, "..");
const read = (file: string) => readFileSync(path.join(dir, file), "utf8");
const tokens = read("tokens.css");
const theme = read("index.css");

/** The custom properties declared in one selector's block. */
function block(css: string, selector: string): Tokens {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("\n}", start + 1));
  const out: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
  }
  return out;
}

function walk(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const full = path.join(folder, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const SCHEMES = ["light", "dark"] as const;
const light = block(tokens, ":root");
const darkOnly = block(tokens, ".dark");
const dark = { ...light, ...darkOnly };
const of = (scheme: (typeof SCHEMES)[number]) =>
  scheme === "light" ? light : dark;

const STATUS = ["success", "warning", "destructive", "info"] as const;
const SURFACES = [
  "card",
  "panel",
  "panel-strong",
  "popover",
  "muted",
  "secondary",
];

/**
 * Every text colour with every surface it is drawn on. On the ground itself
 * only the main text colour is promised; the quieter ones sit on a panel.
 * Each surface is measured over the brightest (dark) or darkest (light) part
 * of the aurora, which is the worst a panel can sit on.
 */
function textPairs(): [string, string[]][] {
  const pairs: [string, string[]][] = [];
  for (const s of ["background", ...SURFACES]) pairs.push(["foreground", [s]]);
  for (const s of SURFACES) pairs.push(["muted-foreground", [s]]);
  for (const s of ["card", "panel-strong", "popover", "secondary"]) {
    pairs.push(["faint-foreground", [s]]);
  }
  // A table row is drawn selected or hovered over the work panel, and the
  // stage rail's second line and the small print sit on it in the faint tier.
  pairs.push(["faint-foreground", ["accent", "panel-strong"]]);
  pairs.push(["faint-foreground", ["dx-hover-bg", "panel-strong"]]);
  pairs.push(["primary-foreground", ["primary"]]);
  pairs.push(["destructive-foreground", ["destructive"]]);
  pairs.push(["accent-foreground", ["accent", "card"]]);
  pairs.push(["sidebar-foreground", ["panel"]]);
  pairs.push(["sidebar-accent-foreground", ["sidebar-accent", "panel"]]);
  for (const status of STATUS) {
    pairs.push([status, [`${status}-surface`]]);
    pairs.push([status, ["card"]]);
  }
  return pairs;
}

describe.each(SCHEMES)("%s scheme", (scheme) => {
  const t = of(scheme);
  const colour = (name: string): Rgba => parseColor(must(t[name]));

  it("keeps every text colour at 4.5:1 on every surface it sits on", () => {
    const failures: string[] = [];
    for (const [text, chain] of textPairs()) {
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

  it("keeps the quiet text at 4.5:1 straight on the ground, where a page head sits", () => {
    // A page's date line, its one-line description, the back link and the
    // count beside a title have no panel under them. In light the aurora
    // darkens the ground and a phone puts them over any of it, so the whole
    // window is the worst case. In dark the head sits right of the panel in the top band: the
    // brightest bloom is at the bottom, under panels.
    const ground = worstGround(
      t,
      scheme === "light" ? undefined : { x0: 0.18, x1: 0.9, y0: 0.08, y1: 0.3 },
    );
    expect(
      contrast(colour("muted-foreground"), ground),
      "muted-foreground on the bare ground",
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the work panel opaque enough for table text", () => {
    // A card that holds a table or a form takes --dx-card-work-bg.
    expect(t["dx-card-work-bg"]).toBe("var(--panel-strong)");
    const under = flatten(colour("panel-strong"), worstGround(t));
    for (const text of ["foreground", "muted-foreground", "faint-foreground"]) {
      expect(
        contrast(colour(text), under),
        `${text} on the work panel`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the focus ring at 3:1 on the page and on a card", () => {
    for (const s of ["background", "card"] as const) {
      expect(contrast(colour("ring"), surface(t, [s]))).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("keeps the gradient title at 3:1 against the ground along its whole length", () => {
    const from = colour("dx-title-from");
    const to = colour("dx-title-to");
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
        `at ${String(i * 10)}%`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives the ground several blooms that actually change it", () => {
    const blooms = parseBlooms(must(t["ground-image"]));
    expect(blooms.length).toBeGreaterThanOrEqual(4);
    // At the centre of the strongest bloom the ground has moved clearly away
    // from the plain background colour.
    const centre = blooms.reduce((a, b) => (b.colour.a > a.colour.a ? b : a));
    const there = groundAt(t, blooms, centre.cx, centre.cy);
    expect(contrast(there, colour("background"))).toBeGreaterThan(1.15);
  });

  it("is glass: a blur, a 16 px card corner, a pill for the current entry", () => {
    expect(must(t["dx-card-filter"])).toContain("blur(");
    expect(t["radius-card"]).toBe("16px");
    expect(t["radius-control"]).toBe("12px");
    expect(t["dx-entry-radius"]).toBe("999px");
    expect(colour("card").a).toBeLessThan(1);
  });

  it("keeps the motion between 150 and 250 ms", () => {
    for (const name of ["motion-fast", "motion-base", "motion-slow"]) {
      const ms = Number.parseFloat(must(t[name]));
      expect(ms, name).toBeGreaterThanOrEqual(150);
      expect(ms, name).toBeLessThanOrEqual(250);
    }
  });
});

describe("the values of the design", () => {
  it("holds the dark scheme, the hero", () => {
    expect(dark.background).toBe("#06162b");
    expect(dark.panel).toBe("rgb(10 24 40 / 0.72)");
    expect(dark["panel-filter"]).toBe("blur(18px) saturate(140%)");
    expect(dark.foreground).toBe("#f1fbfb");
    expect(dark["muted-foreground"]).toBe("#b3ccd1");
    expect(dark["faint-foreground"]).toBe("#8faab2");
    expect(dark.primary).toBe("#2ee6d6");
    expect(dark["primary-foreground"]).toBe("#04121c");
    expect(dark.glow).toBe("0 0 24px rgb(46 230 214 / 0.35)");
    // Indigo stays at 15% or less of the aurora.
    expect(dark["ground-image"]).toContain("rgb(91 108 255 / 0.15)");
  });

  it("holds the light scheme", () => {
    expect(light.background).toBe("#f2f9fa");
    expect(light.panel).toBe("rgb(255 255 255 / 0.82)");
    expect(light.primary).toBe("#0e7c86");
    expect(light["accent-foreground"]).toBe("#0b7480");
    expect(light.glow).toBe("0 8px 28px rgb(14 124 134 / 0.18)");
    expect(light["motion-base"]).toBe("220ms");
    expect(light["spring-stiffness"]).toBe("260");
    expect(light["spring-damping"]).toBe("28");
    expect(light["spring-pop-stiffness"]).toBe("400");
    expect(light["spring-pop-damping"]).toBe("28");
  });

  it("has a dark value for every colour", () => {
    // A colour is written as hex or rgb(); the rest (radii, blur, motion)
    // is shared by both schemes.
    const colours = Object.entries(light).filter(([, value]) =>
      /^(#|rgb)/.test(value),
    );
    expect(colours.length).toBeGreaterThan(30);
    for (const [name] of colours) {
      expect(Object.keys(darkOnly), name).toContain(name);
    }
  });

  it("defines every structure variable the styles read", () => {
    const wanted = new Set<string>();
    for (const file of walk(src).filter((f) => f.endsWith(".css"))) {
      for (const m of readFileSync(file, "utf8").matchAll(
        /var\(--(dx-[\w-]+)(?!-h\b)/g,
      )) {
        wanted.add(must(m[1]));
      }
    }
    expect(wanted.size).toBeGreaterThan(10);
    // --dx-chrome-h is set at run time by the preview tag, with a fallback.
    expect(
      [...wanted].filter((n) => n !== "dx-chrome-h" && light[n] === undefined),
    ).toEqual([]);
  });

  it("puts every spacing token on the 8-pt grid", () => {
    const spaces = Object.entries(light).filter(([name]) =>
      name.startsWith("space-"),
    );
    expect(spaces.length).toBeGreaterThan(0);
    for (const [name, value] of spaces) {
      expect((parseFloat(value) * 16) % 8, name).toBe(0);
    }
  });

  it("sets the page rhythm on the 8-pt grid: card padding, head gap, stack and grid gap", () => {
    // Each is one of the --space-* tokens, so it is on the grid by being one.
    const px = (name: string) => {
      const value = must(light[name]);
      const ref = /^var\(--(space-\d+)\)$/.exec(value);
      const size = ref ? light[must(ref[1])] : value;
      return parseFloat(must(size)) * 16;
    };
    expect(px("dx-card-pad")).toBe(24);
    expect(px("dx-head-gap")).toBe(24);
    expect(px("dx-stack")).toBe(32);
    expect(px("dx-grid-gap")).toBe(24);
    for (const name of [
      "dx-card-pad",
      "dx-head-gap",
      "dx-stack",
      "dx-grid-gap",
    ]) {
      expect(px(name) % 8, name).toBe(0);
    }
  });

  it("defines radius and an ease-out curve", () => {
    expect(light.radius).toBeDefined();
    expect(light["ease-out"]).toContain("cubic-bezier");
  });
});

describe("the type scale", () => {
  const SIZES = [12, 14, 16, 18, 20, 28, 32];

  it("has exactly seven sizes: 12, 14, 16, 18, 20, 28 and 32 px", () => {
    const sizes = Object.entries(light)
      .filter(([name]) => name.startsWith("type-"))
      .map(([name, value]) => [Number(name.slice(5)), parseFloat(value) * 16]);
    expect(sizes.map(([name]) => name)).toEqual(SIZES);
    for (const [name, px] of sizes) expect(px).toBe(name);
  });

  it("gives Tailwind's text-* the same seven and no others", () => {
    const names = [...theme.matchAll(/--text-(\w+):\s*var\(--type-(\d+)\);/g)];
    expect(names.map((m) => Number(m[2]))).toEqual(SIZES);
    // Nothing in the theme declares a size of its own.
    expect([...theme.matchAll(/--text-\w+:\s*[\d.]+rem;/g)]).toEqual([]);
  });

  it("is the scale of the fs-* classes too", () => {
    const classes = [
      ...read("type.css").matchAll(
        /\.fs-(\d+)\s*\{\s*font-size: var\(--type-(\d+)\)/g,
      ),
    ];
    expect(classes.map((m) => Number(m[1]))).toEqual(SIZES);
    for (const m of classes) expect(m[1]).toBe(m[2]);
  });

  /** Files whose own area owns a size outside the scale. They are named, not hidden. */
  const NOT_OURS = new Set([
    "features/order-tracker/DocsBadges.tsx",
    "features/order-tracker/trackerColumns.tsx",
  ]);

  it("is the only scale anywhere in the app's styles and components", () => {
    const stray: string[] = [];
    for (const file of walk(src)) {
      const rel = path.relative(src, file).replaceAll("\\", "/");
      if (/\.test\.|printForm|printDocument/.test(rel) || NOT_OURS.has(rel)) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\btext-\[\d[^\]]*\]/g)) {
        stray.push(`${rel}: ${m[0]}`);
      }
      for (const m of text.matchAll(/font-size:\s*([\d.]+)(px|rem)\b/g)) {
        const px = Number(m[1]) * (m[2] === "rem" ? 16 : 1);
        if (!SIZES.includes(px)) {
          stray.push(`${rel}: font-size ${must(m[1])}${must(m[2])}`);
        }
      }
      for (const m of text.matchAll(/\bfs-(\d+)\b/g)) {
        if (!SIZES.includes(Number(m[1]))) stray.push(`${rel}: ${m[0]}`);
      }
    }
    expect(stray).toEqual([]);
  });
});

describe("one design", () => {
  it("has no data-direction anywhere", () => {
    const found: string[] = [];
    for (const file of walk(src)) {
      if (file === import.meta.filename) continue;
      if (
        /data-direction|dataset\.direction/.test(readFileSync(file, "utf8"))
      ) {
        found.push(path.relative(src, file));
      }
    }
    expect(found).toEqual([]);
    expect(
      readFileSync(path.join(src, "..", "index.html"), "utf8"),
    ).not.toContain("data-direction");
  });

  it("switches page-change animation off under reduced motion", () => {
    expect(read("motion.css")).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*view-transition-new/,
    );
    expect(read("motion.css")).toContain("::view-transition-new(.dx-page)");
  });
});

describe("the colour maths", () => {
  it("is 21:1 for black on white and 1:1 for equal colours", () => {
    const black = parseColor("#000000");
    const white = parseColor("#ffffff");
    expect(contrast(black, white)).toBeCloseTo(21, 5);
    expect(contrast(parseColor("#777777"), parseColor("#777777"))).toBeCloseTo(
      1,
      5,
    );
  });

  it("fails a pair that is too pale", () => {
    expect(contrast(parseColor("#999999"), parseColor("#ffffff"))).toBeLessThan(
      4.5,
    );
  });

  it("measures the worst ground by sampling, not by stacking every layer", () => {
    const t = {
      background: "#000000",
      "ground-image":
        "radial-gradient(40% 40% at 0% 0%, #ffffff, transparent 100%), radial-gradient(40% 40% at 100% 100%, #ffffff, transparent 100%)",
    };
    // Two white blooms in opposite corners never overlap, so the brightest
    // point is one bloom at full strength, not two stacked.
    expect(worstGround(t).r).toBeGreaterThan(250);
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
    const pale = {
      background: "#ffffff",
      "ground-image":
        "radial-gradient(30% 30% at 0% 0%, #000000, transparent 100%)",
    };
    expect(worstGround(pale).r).toBeLessThan(5);
  });
});
